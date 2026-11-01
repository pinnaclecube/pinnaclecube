/**
 * importTemplateFromDrive.ts — Evidence Package template importer (spec §8.2).
 *
 * Reads each .docx in the _Templates Shared Drive folder, extracts its heading
 * hierarchy + regulation citations with scripts/readDocxHeadings.py (python-docx),
 * infers the document role from the exhibit code in the FILE NAME, and writes
 * lib/shared/src/packageTemplateConfig.draft.json. It stores NO sample prose —
 * only headings, their order, and regulation citations. Then it prints the seeded
 * config vs the draft side by side with every difference. The draft is never
 * auto-merged; a human picks which differences to take.
 *
 * Run (needs Drive env + python-docx):
 *   GOOGLE_SERVICE_ACCOUNT_JSON=... pnpm --filter @workspace/scripts exec \
 *     tsx src/importTemplateFromDrive.ts
 */

import { google } from "googleapis";
import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { PACKAGE_TEMPLATES, describeExhibitCode, type DocRole } from "@workspace/shared";

const TEMPLATES_FOLDER_ID = process.env.TEMPLATES_FOLDER_ID ?? "12PZ33TFh81wCSk06ni2XFdK0c8Cy2Z0j";
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!SA_JSON) { console.error("ERROR: GOOGLE_SERVICE_ACCOUNT_JSON not set"); process.exit(1); }

const READER = path.resolve(process.cwd(), "scripts", "readDocxHeadings.py");
const DRAFT_OUT = path.resolve(process.cwd(), "lib", "shared", "src", "packageTemplateConfig.draft.json");

function buildDriveClient() {
  const credentials = JSON.parse(SA_JSON!) as Record<string, unknown>;
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/drive"] });
  return google.drive({ version: "v3", auth });
}
const drive = buildDriveClient();

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface DocxHeadings { ok: boolean; headings?: { level: number; text: string }[]; regulations?: string[]; error?: string }
interface DraftRole { sections: { heading: string; level: number }[]; regulations: string[]; sourceFiles: string[] }

/** Infer the document role from the exhibit code embedded in the file name. */
function roleFromFileName(name: string): DocRole | null {
  const stem = name.replace(/\.docx$/i, "");
  const token = stem.match(/\b(FM|INDEX|[A-J]\d+|[A-J])\b/i);
  if (!token) return null;
  return describeExhibitCode(token[1]).role;
}

async function listTemplateDocx(): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${TEMPLATES_FOLDER_ID}' in parents and mimeType='${DOCX_MIME}' and trashed=false`,
      fields: "nextPageToken, files(id,name)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });
    for (const f of res.data.files ?? []) if (f.id && f.name) out.push({ id: f.id, name: f.name });
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

async function downloadDocx(fileId: string): Promise<Buffer> {
  const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer);
}

function readHeadings(buf: Buffer): DocxHeadings {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "tpl-"));
  try {
    const f = path.join(tmp, "t.docx");
    writeFileSync(f, buf);
    const stdout = execFileSync("python3", [READER, f], { maxBuffer: 16 * 1024 * 1024 }).toString();
    return JSON.parse(stdout) as DocxHeadings;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const files = await listTemplateDocx();
  console.log(`Found ${files.length} .docx in _Templates (${TEMPLATES_FOLDER_ID}).`);
  if (files.length === 0) {
    console.log("Nothing to import — the seeded config stands unchanged.");
    return;
  }

  const draft: Record<string, DraftRole> = {};
  for (const f of files) {
    const role = roleFromFileName(f.name);
    if (!role) { console.log(`  skip (no exhibit code in name): ${f.name}`); continue; }
    const parsed = readHeadings(await downloadDocx(f.id));
    if (!parsed.ok) { console.log(`  error reading ${f.name}: ${parsed.error}`); continue; }
    const slot = (draft[role] ??= { sections: [], regulations: [], sourceFiles: [] });
    slot.sourceFiles.push(f.name);
    // first file per role defines the section order; later files only add citations
    if (slot.sections.length === 0) slot.sections = (parsed.headings ?? []).map((h) => ({ heading: h.text, level: h.level }));
    for (const r of parsed.regulations ?? []) if (!slot.regulations.includes(r)) slot.regulations.push(r);
    console.log(`  ${f.name} -> role=${role}, ${parsed.headings?.length ?? 0} heading(s)`);
  }

  writeFileSync(DRAFT_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), roles: draft }, null, 2));
  console.log(`\nDraft written: ${DRAFT_OUT}`);

  // Side-by-side diff vs the seeded config.
  console.log("\n=== Seeded config vs draft (differences) ===");
  const seeded = PACKAGE_TEMPLATES.EB1A.roles;
  for (const role of Object.keys(seeded) as DocRole[]) {
    const seededHeadings = seeded[role].sections.map((s: { heading: string }) => s.heading).filter(Boolean);
    const draftHeadings = (draft[role]?.sections ?? []).map((s) => s.heading).filter(Boolean);
    if (!draft[role]) { console.log(`[${role}] no template file found — keep seeded (${seededHeadings.join(" › ")})`); continue; }
    const onlySeeded = seededHeadings.filter((h) => !draftHeadings.includes(h));
    const onlyDraft = draftHeadings.filter((h) => !seededHeadings.includes(h));
    if (onlySeeded.length === 0 && onlyDraft.length === 0 && seededHeadings.join("|") === draftHeadings.join("|")) {
      console.log(`[${role}] identical`);
    } else {
      console.log(`[${role}] seeded: ${seededHeadings.join(" › ")}`);
      console.log(`[${role}] draft : ${draftHeadings.join(" › ")}`);
      if (onlySeeded.length) console.log(`         only in seeded: ${onlySeeded.join(", ")}`);
      if (onlyDraft.length) console.log(`         only in draft : ${onlyDraft.join(", ")}`);
    }
  }
  console.log("\nDraft is NOT merged. Tell the importer owner which differences to take.");
}

main().catch((err) => { console.error("import failed:", err); process.exit(1); });
