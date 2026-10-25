/**
 * evidenceGroupingService.ts — Pinnacle³
 *
 * Step 5 — AI evidence grouping. Clusters a case's UNGROUPED evidence files into
 * logical-accomplishment groups (certificate + confirmation email = one group) and
 * proposes add-to-existing-confirmed-group suggestions. Persisted as 'suggested'
 * evidence_groups + evidence_group_suggestions; files' group_id is set only on
 * staff confirm. Reuses the Step 4 extraction utility and the getAI() pattern.
 */

import { eq, and, inArray, isNull } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import {
  db,
  caseFolderItemsTable,
  evidenceGroupsTable,
  evidenceGroupSuggestionsTable,
} from "@workspace/db";
import { downloadDriveFile } from "./driveService";
import { extractText } from "./evidenceProcessing";
import { getEvidenceSubtreeFolders } from "./evidenceSyncService";
import { logger } from "../lib/logger";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4000;
const SNIPPET_CHARS = 300;
const EXTRACT_FILE_CAP = 40;        // bound downloads per run (filenames are sent for all)
const EXTRACT_CONCURRENCY = 6;
const EXTRACT_BUDGET_MS = 20000;    // stop downloading once this much time is spent on extraction
const MODEL_TIMEOUT_MS = 35000;     // first model attempt
const MODEL_RETRY_TIMEOUT_MS = 18000; // parse-retry attempt
// The whole run must finish inside the serverless function's maxDuration (60s):
// bounded extraction + one bounded model call + a short parse-retry leaves margin.
const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Module-level snippet cache (survives within a warm instance → no re-download on
// repeat runs). Keyed by Drive file id.
const snippetCache = new Map<string, string>();

function getAI(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned) as T;
}

// ─── Input assembly ────────────────────────────────────────────────────────────

interface UngroupedFile {
  id: number; name: string; mimeType: string; criterion: string | null;
  createdAt: string; driveId: string; snippet?: string;
}

async function extractSnippet(driveId: string, mimeType: string, name: string): Promise<string | null> {
  if (snippetCache.has(driveId)) return snippetCache.get(driveId)!;
  try {
    const buffer = await downloadDriveFile(driveId);
    const text = await extractText(buffer, mimeType, name);
    const snippet = (text ?? "").replace(/\s+/g, " ").trim().slice(0, SNIPPET_CHARS);
    snippetCache.set(driveId, snippet);
    return snippet || null;
  } catch {
    return null; // skip extraction failures silently
  }
}

async function withConcurrency<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

async function assembleInput(caseId: number) {
  const subtree = await getEvidenceSubtreeFolders(caseId);
  const folderIds = subtree.map((f) => f.id);

  const ungrouped: UngroupedFile[] =
    folderIds.length === 0
      ? []
      : (
          await db
            .select()
            .from(caseFolderItemsTable)
            .where(
              and(
                inArray(caseFolderItemsTable.caseFolderId, folderIds),
                eq(caseFolderItemsTable.isDeletedInDrive, false),
                isNull(caseFolderItemsTable.groupId),
              ),
            )
        ).map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          criterion: f.criterionFolder,
          createdAt: (f.createdAt instanceof Date ? f.createdAt : new Date(f.createdAt)).toISOString().slice(0, 10),
          driveId: f.driveId,
        }));

  // Snippets for up to EXTRACT_FILE_CAP PDF/DOCX files (names are sent for all).
  // Bounded by a wall-clock budget so downloads can never consume the whole
  // function timeout — files not reached in time are sent name-only.
  const extractable = ungrouped.filter((f) => f.mimeType === PDF || f.mimeType === DOCX).slice(0, EXTRACT_FILE_CAP);
  const extractStart = Date.now();
  await withConcurrency(extractable, EXTRACT_CONCURRENCY, async (f) => {
    if (Date.now() - extractStart > EXTRACT_BUDGET_MS) return; // out of budget → name-only
    const s = await extractSnippet(f.driveId, f.mimeType, f.name);
    if (s) f.snippet = s;
  });

  // Confirmed groups (never modified; shown so the model can propose add-to-group).
  const confirmedGroups = await db
    .select({ id: evidenceGroupsTable.id, name: evidenceGroupsTable.name, description: evidenceGroupsTable.description, criterion: evidenceGroupsTable.criterionFolder })
    .from(evidenceGroupsTable)
    .where(and(eq(evidenceGroupsTable.caseId, caseId), eq(evidenceGroupsTable.status, "confirmed")));

  const groupMembers = new Map<number, string[]>();
  if (confirmedGroups.length > 0) {
    const members = await db
      .select({ groupId: caseFolderItemsTable.groupId, name: caseFolderItemsTable.name })
      .from(caseFolderItemsTable)
      .where(inArray(caseFolderItemsTable.groupId, confirmedGroups.map((g) => g.id)));
    for (const m of members) {
      if (m.groupId == null) continue;
      const list = groupMembers.get(m.groupId) ?? [];
      list.push(m.name);
      groupMembers.set(m.groupId, list);
    }
  }

  return {
    ungrouped,
    confirmedGroups: confirmedGroups.map((g) => ({ ...g, members: groupMembers.get(g.id) ?? [] })),
    ungroupedIds: new Set(ungrouped.map((f) => f.id)),
    confirmedIds: new Set(confirmedGroups.map((g) => g.id)),
  };
}

// ─── Model ──────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You organize a petition case's evidence FILES into GROUPS. One group = one logical accomplishment that several files document together (for example a certificate, its confirmation email, and the public announcement of the SAME fellowship = ONE group).

Rules:
- Cluster only files that document the SAME underlying accomplishment. When in doubt, leave a file ungrouped — do not force buckets.
- Never group files across different criterion folders unless the text makes it unmistakably the same item.
- Give each new group a short, specific name (e.g. "SCRS Fellow Certification 2024") and a one-line description.
- You may propose ADDING an ungrouped file to an existing CONFIRMED group, but never rename, re-describe, or remove members from confirmed groups.
- Use ONLY the file ids provided. Every file id you output must come from the ungrouped list.

Return ONLY strict JSON, no prose, no code fences, in exactly this shape:
{"new_groups":[{"name":string,"description":string,"criterion_folder":string,"file_ids":[number],"rationale":string}],"add_to_groups":[{"group_id":number,"file_ids":[number],"rationale":string}]}`;

const GroupingResult = z.object({
  new_groups: z.array(z.object({
    name: z.string().min(1),
    description: z.string().nullish(),
    criterion_folder: z.string().nullish(),
    file_ids: z.array(z.number().int()).min(1),
    rationale: z.string().nullish(),
  })).default([]),
  add_to_groups: z.array(z.object({
    group_id: z.number().int(),
    file_ids: z.array(z.number().int()).min(1),
    rationale: z.string().nullish(),
  })).default([]),
});
type GroupingResultT = z.infer<typeof GroupingResult>;

function buildUserMessage(input: Awaited<ReturnType<typeof assembleInput>>): string {
  const files = input.ungrouped.map((f) =>
    `  {id:${f.id}, name:${JSON.stringify(f.name)}, criterion:${JSON.stringify(f.criterion ?? "unclassified")}, date:${f.createdAt}${f.snippet ? `, text:${JSON.stringify(f.snippet)}` : ""}}`,
  ).join("\n");
  const groups = input.confirmedGroups.map((g) =>
    `  {group_id:${g.id}, name:${JSON.stringify(g.name)}, criterion:${JSON.stringify(g.criterion ?? "unclassified")}, members:${JSON.stringify(g.members)}}`,
  ).join("\n");
  return `UNGROUPED FILES (cluster these):\n${files || "  (none)"}\n\nEXISTING CONFIRMED GROUPS (never modify; you may suggest adding ungrouped files):\n${groups || "  (none)"}\n\nReturn the JSON now.`;
}

async function callModel(userMessage: string): Promise<GroupingResultT> {
  const ai = getAI();
  const run = async (timeoutMs: number) => {
    const res = await ai.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { timeout: timeoutMs, maxRetries: 0 },
    );
    const raw = res.content.map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("");
    return GroupingResult.parse(extractJson(raw));
  };
  try {
    return await run(MODEL_TIMEOUT_MS);
  } catch (err) {
    // Only retry parse/validation failures. A transport error or timeout won't be
    // fixed by an immediate retry and would risk overrunning the function budget —
    // fail fast and let the worker re-queue the job on the next cron tick.
    if (err instanceof Anthropic.APIError) throw err;
    logger.warn({ err }, "[evidenceGrouping] first parse failed — retrying once");
    return await run(MODEL_RETRY_TIMEOUT_MS);
  }
}

// ─── Persist ────────────────────────────────────────────────────────────────────

async function persist(
  caseId: number,
  result: GroupingResultT,
  input: Awaited<ReturnType<typeof assembleInput>>,
): Promise<{ newGroups: number; addSuggestions: number }> {
  const usedFileIds = new Set<number>();
  let newGroups = 0;
  let addSuggestions = 0;

  await db.transaction(async (tx) => {
    // Clear prior un-acted AI suggestions for this case (keep confirmed groups).
    await tx
      .delete(evidenceGroupsTable)
      .where(and(
        eq(evidenceGroupsTable.caseId, caseId),
        eq(evidenceGroupsTable.status, "suggested"),
        eq(evidenceGroupsTable.createdBy, "ai"),
      ));
    // Clear prior add-to-confirmed suggestions for this case's confirmed groups.
    if (input.confirmedIds.size > 0) {
      await tx
        .delete(evidenceGroupSuggestionsTable)
        .where(and(
          eq(evidenceGroupSuggestionsTable.isAddToConfirmed, true),
          inArray(evidenceGroupSuggestionsTable.groupId, [...input.confirmedIds]),
        ));
    }

    for (const g of result.new_groups) {
      const fileIds = g.file_ids.filter((id) => input.ungroupedIds.has(id) && !usedFileIds.has(id));
      if (fileIds.length === 0) continue;
      for (const id of fileIds) usedFileIds.add(id);
      const [group] = await tx
        .insert(evidenceGroupsTable)
        .values({
          caseId,
          name: g.name.slice(0, 200),
          description: g.description?.trim() || null,
          criterionFolder: g.criterion_folder ?? null,
          createdBy: "ai",
          status: "suggested",
          aiRationale: g.rationale?.trim() || null,
        })
        .returning();
      await tx.insert(evidenceGroupSuggestionsTable).values(
        fileIds.map((fileId) => ({ groupId: group.id, fileId, isAddToConfirmed: false })),
      );
      newGroups++;
    }

    for (const a of result.add_to_groups) {
      if (!input.confirmedIds.has(a.group_id)) continue;
      const fileIds = a.file_ids.filter((id) => input.ungroupedIds.has(id) && !usedFileIds.has(id));
      if (fileIds.length === 0) continue;
      for (const id of fileIds) usedFileIds.add(id);
      await tx
        .insert(evidenceGroupSuggestionsTable)
        .values(fileIds.map((fileId) => ({ groupId: a.group_id, fileId, isAddToConfirmed: true })))
        .onConflictDoNothing();
      addSuggestions += fileIds.length;
    }
  });

  return { newGroups, addSuggestions };
}

export async function runGroupingForCase(caseId: number): Promise<{ newGroups: number; addSuggestions: number }> {
  const input = await assembleInput(caseId);
  if (input.ungrouped.length === 0) {
    logger.info({ caseId }, "[evidenceGrouping] no ungrouped files — nothing to propose");
    return { newGroups: 0, addSuggestions: 0 };
  }
  const result = await callModel(buildUserMessage(input));
  const counts = await persist(caseId, result, input);
  logger.info({ caseId, ...counts, ungrouped: input.ungrouped.length }, "[evidenceGrouping] proposals persisted");
  return counts;
}

// Count of ungrouped, non-deleted evidence files in a case (for the auto-trigger).
export async function ungroupedFileCount(caseId: number): Promise<number> {
  const subtree = await getEvidenceSubtreeFolders(caseId);
  const folderIds = subtree.map((f) => f.id);
  if (folderIds.length === 0) return 0;
  const rows = await db
    .select({ id: caseFolderItemsTable.id })
    .from(caseFolderItemsTable)
    .where(and(
      inArray(caseFolderItemsTable.caseFolderId, folderIds),
      eq(caseFolderItemsTable.isDeletedInDrive, false),
      isNull(caseFolderItemsTable.groupId),
    ));
  return rows.length;
}
