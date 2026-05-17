/**
 * ExhibitsTab.tsx — Pinnacle³
 *
 * Staff-facing Exhibit Management panel embedded in InternalCaseDetail.
 * Left column: generation controls with live job status.
 * Right column: document library grouped by type.
 * Bottom: petition completeness checklist.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import {
  Loader2, CheckCircle2, XCircle, ExternalLink,
  FileText, AlertTriangle, Eye, EyeOff, RefreshCw, Upload,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── staffFetch ───────────────────────────────────────────────────────────────

function staffFetch(path: string, opts: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      "X-Staff-Token": getStaffToken() ?? "",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers ?? {}),
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, React.ReactNode> = {
  not_started: null,
  pending: <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />,
  generating: <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />,
  draft: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

function statusIcon(status: string | null | undefined) {
  return STATUS_ICONS[status ?? "not_started"] ?? null;
}

function isGenerating(status: string | null | undefined) {
  return status === "pending" || status === "generating";
}

function isDone(status: string | null | undefined) {
  return status === "draft" || status === "completed";
}

// ─── GenerationRow ────────────────────────────────────────────────────────────

function GenerationRow({
  label, status, driveUrl, busy,
  onGenerate, onOpen,
}: {
  label: string;
  status: string | null | undefined;
  driveUrl?: string | null;
  busy: boolean;
  onGenerate: () => void;
  onOpen?: () => void;
}) {
  const generating = isGenerating(status) || busy;
  const done = isDone(status);
  const failed = status === "failed";

  return (
    <div className="flex items-center gap-2 py-2 border-b last:border-b-0">
      <div className="w-4 shrink-0">{statusIcon(busy ? "generating" : status)}</div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", done ? "text-green-700 font-medium" : failed ? "text-red-600" : "text-foreground")}>
          {label}
        </p>
        {generating && <p className="text-xs text-blue-600 mt-0.5">Generating document…</p>}
        {failed && <p className="text-xs text-red-500 mt-0.5">Generation failed — retry below</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {driveUrl && done && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onOpen} title="Open in Drive">
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button
          size="sm" variant="outline" className="h-7 text-xs"
          onClick={onGenerate} disabled={generating}
        >
          {generating
            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</>
            : done ? <><RefreshCw className="w-3 h-3 mr-1" />Redo</> : "Generate"
          }
        </Button>
      </div>
    </div>
  );
}

// ─── GenerationPanel (left column) ───────────────────────────────────────────

function GenerationPanel({
  caseSetupId, criteria, pkg, busy, setBusy,
}: {
  caseSetupId: number;
  criteria: any[];
  pkg: any;
  busy: Record<string, boolean>;
  setBusy: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const [runningPackage, setRunningPackage] = useState(false);

  const fire = async (key: string, path: string) => {
    setBusy((p) => ({ ...p, [key]: true }));
    try {
      await staffFetch(`/cases/${caseSetupId}/exhibits/generate/${path}`, { method: "POST" });
    } finally {
      // keep busy for 10s to show spinner before polling catches up
      setTimeout(() => setBusy((p) => ({ ...p, [key]: false })), 10_000);
    }
  };

  const generateFullPackage = async () => {
    setRunningPackage(true);
    setBusy((p) => ({ ...p, all: true }));
    try {
      await fire("all", "all");
      await new Promise((r) => setTimeout(r, 5000));
      fire("cover_letter", "cover-letter");
      await new Promise((r) => setTimeout(r, 5000));
      fire("personal_declaration", "personal-declaration");
      await new Promise((r) => setTimeout(r, 5000));
      fire("field_brief", "field-brief");
    } finally {
      setRunningPackage(false);
      setBusy((p) => ({ ...p, all: false }));
    }
  };

  const criteriaGenerating = criteria.some((c) => isGenerating(c.status) || busy[`criteria_${c.criteriaCode}`]);

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Generation Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Full package */}
        <Button
          className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] text-white text-xs h-8"
          onClick={generateFullPackage}
          disabled={runningPackage}
        >
          {runningPackage
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating Package…</>
            : <><FileText className="w-3.5 h-3.5 mr-1.5" />Generate Full Package</>
          }
        </Button>

        {runningPackage && (
          <p className="text-xs text-muted-foreground text-center -mt-2">
            Queuing cover letter, declaration & brief in sequence…
          </p>
        )}

        {/* Criteria exhibits */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Criteria Exhibits</p>
          <div>
            {criteria.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">No criteria configured.</p>
            ) : (
              criteria.map((c) => (
                <GenerationRow
                  key={c.criteriaCode}
                  label={`${c.exhibitLabel ? `Exhibit ${c.exhibitLabel} — ` : ""}${c.criteriaName}`}
                  status={busy[`criteria_${c.criteriaCode}`] ? "generating" : c.status}
                  driveUrl={c.driveUrl}
                  busy={!!busy[`criteria_${c.criteriaCode}`]}
                  onGenerate={() => fire(`criteria_${c.criteriaCode}`, `criteria/${c.criteriaCode}`)}
                  onOpen={() => c.driveUrl && window.open(c.driveUrl, "_blank")}
                />
              ))
            )}
          </div>
          {criteriaGenerating && (
            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating criteria exhibits — may take a few minutes…
            </p>
          )}
        </div>

        {/* Supporting documents */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Supporting Documents</p>
          <GenerationRow
            label="Cover Letter"
            status={busy.cover_letter ? "generating" : pkg?.coverLetterStatus}
            driveUrl={pkg?.coverLetterDriveUrl}
            busy={!!busy.cover_letter}
            onGenerate={() => fire("cover_letter", "cover-letter")}
            onOpen={() => pkg?.coverLetterDriveUrl && window.open(pkg.coverLetterDriveUrl, "_blank")}
          />
          <GenerationRow
            label="Personal Declaration"
            status={busy.personal_declaration ? "generating" : pkg?.personalDeclarationStatus}
            driveUrl={pkg?.personalDeclarationDriveUrl}
            busy={!!busy.personal_declaration}
            onGenerate={() => fire("personal_declaration", "personal-declaration")}
            onOpen={() => pkg?.personalDeclarationDriveUrl && window.open(pkg.personalDeclarationDriveUrl, "_blank")}
          />
          <GenerationRow
            label="Field of Significance Brief"
            status={busy.field_brief ? "generating" : pkg?.fieldBriefStatus}
            driveUrl={pkg?.fieldBriefDriveUrl}
            busy={!!busy.field_brief}
            onGenerate={() => fire("field_brief", "field-brief")}
            onOpen={() => pkg?.fieldBriefDriveUrl && window.open(pkg.fieldBriefDriveUrl, "_blank")}
          />
          <GenerationRow
            label="Recommendation Letter Templates"
            status={busy.reco_templates ? "generating" : pkg?.recoTemplatesStatus}
            driveUrl={null}
            busy={!!busy.reco_templates}
            onGenerate={() => fire("reco_templates", "recommendation-templates")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── DocRow ───────────────────────────────────────────────────────────────────

function DocRow({
  doc, caseSetupId, onTogglePublish, busy, onRegenerate,
}: {
  doc: any;
  caseSetupId: number;
  onTogglePublish: (id: number, publish: boolean) => Promise<void>;
  busy: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-2 pl-3 border-b last:border-0 hover:bg-gray-50/60 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {doc.exhibitLabel && <span className="font-mono mr-1.5">Ex. {doc.exhibitLabel}</span>}
          {doc.generatedAt ? new Date(doc.generatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full border font-medium",
          doc.publishedToClient
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-gray-100 text-gray-500 border-gray-200",
        )}>
          {doc.publishedToClient ? "Visible to Client" : "Staff Only"}
        </span>
        {doc.driveUrl && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Open in Drive"
            onClick={() => window.open(doc.driveUrl, "_blank")}>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title={doc.publishedToClient ? "Unpublish" : "Publish to client"}
          onClick={() => onTogglePublish(doc.id, !doc.publishedToClient)}
          disabled={busy}>
          {doc.publishedToClient
            ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
            : <Eye className="w-3.5 h-3.5 text-[#1E2D6B]" />
          }
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Regenerate" onClick={onRegenerate}>
          <RefreshCw className="w-3 h-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

// ─── DocumentLibrary (right column) ──────────────────────────────────────────

function DocumentLibrary({
  caseSetupId, criteria, docsByType, recoLetters,
  onTogglePublish, publishBusy, onRegenerate,
}: {
  caseSetupId: number;
  criteria: any[];
  docsByType: Record<string, any[]>;
  recoLetters: any[];
  onTogglePublish: (id: number, publish: boolean) => Promise<void>;
  publishBusy: Record<number, boolean>;
  onRegenerate: (docType: string, criteriaCode?: string) => void;
}) {
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());

  const toggleCriteria = (code: string) => setExpandedCriteria((prev) => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  const allCriteriaDocs = [
    ...(docsByType["criteria_exhibit"] ?? []),
    ...(docsByType["exhibit_index"] ?? []),
    ...(docsByType["sub_exhibit"] ?? []),
  ];

  const docsByCriteria: Record<string, any[]> = {};
  for (const doc of allCriteriaDocs) {
    const key = doc.criteriaCode ?? "unknown";
    (docsByCriteria[key] ??= []).push(doc);
  }

  const supportingDocs = [
    ...(docsByType["cover_letter"] ?? []),
    ...(docsByType["personal_declaration"] ?? []),
    ...(docsByType["field_brief"] ?? []),
  ];

  const recoTemplateDocs = docsByType["reco_template"] ?? [];

  const totalDocs = allCriteriaDocs.length + supportingDocs.length + recoTemplateDocs.length;

  return (
    <div className="space-y-5">
      {totalDocs === 0 && supportingDocs.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No documents generated yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Use the controls on the left to start generating.</p>
          </CardContent>
        </Card>
      )}

      {/* Criteria exhibits */}
      {criteria.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Criteria Exhibits
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {criteria.map((c) => {
              const docs = docsByCriteria[c.criteriaCode] ?? [];
              const expanded = expandedCriteria.has(c.criteriaCode);
              const mainDocs = docs.filter((d) => d.documentType === "criteria_exhibit");
              const indexDocs = docs.filter((d) => d.documentType === "exhibit_index");
              const subDocs = docs.filter((d) => d.documentType === "sub_exhibit");
              const hasDocs = docs.length > 0;

              return (
                <div key={c.criteriaCode}>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => hasDocs && toggleCriteria(c.criteriaCode)}
                  >
                    {hasDocs
                      ? expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      : <div className="w-3.5" />
                    }
                    {c.exhibitLabel && (
                      <span className="text-xs font-mono font-bold text-[#1E2D6B] w-5 shrink-0">
                        {c.exhibitLabel}
                      </span>
                    )}
                    <span className="text-sm font-medium flex-1">{c.criteriaName}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full border font-medium shrink-0",
                      hasDocs ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200",
                    )}>
                      {hasDocs ? `${docs.length} doc${docs.length !== 1 ? "s" : ""}` : "Not generated"}
                    </span>
                  </button>

                  {expanded && hasDocs && (
                    <div className="bg-gray-50/50 border-t">
                      {mainDocs.map((doc) => (
                        <DocRow key={doc.id} doc={doc} caseSetupId={caseSetupId}
                          onTogglePublish={onTogglePublish}
                          busy={!!publishBusy[doc.id]}
                          onRegenerate={() => onRegenerate("criteria_exhibit", c.criteriaCode)}
                        />
                      ))}
                      {indexDocs.map((doc) => (
                        <DocRow key={doc.id} doc={doc} caseSetupId={caseSetupId}
                          onTogglePublish={onTogglePublish}
                          busy={!!publishBusy[doc.id]}
                          onRegenerate={() => onRegenerate("exhibit_index", c.criteriaCode)}
                        />
                      ))}
                      {subDocs.map((doc) => (
                        <DocRow key={doc.id} doc={doc} caseSetupId={caseSetupId}
                          onTogglePublish={onTogglePublish}
                          busy={!!publishBusy[doc.id]}
                          onRegenerate={() => onRegenerate("sub_exhibit", c.criteriaCode)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Supporting documents */}
      {supportingDocs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Supporting Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {supportingDocs.map((doc) => (
              <DocRow key={doc.id} doc={doc} caseSetupId={caseSetupId}
                onTogglePublish={onTogglePublish}
                busy={!!publishBusy[doc.id]}
                onRegenerate={() => onRegenerate(doc.documentType)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reco templates */}
      {(recoTemplateDocs.length > 0 || recoLetters.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recommendation Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recoTemplateDocs.map((doc) => (
              <DocRow key={doc.id} doc={doc} caseSetupId={caseSetupId}
                onTogglePublish={onTogglePublish}
                busy={!!publishBusy[doc.id]}
                onRegenerate={() => onRegenerate("reco_template")}
              />
            ))}
            {recoTemplateDocs.length === 0 && (
              <p className="text-sm text-muted-foreground italic px-4 py-3">
                No templates generated yet — use the generation controls.
              </p>
            )}
            {recoLetters.length > 0 && (
              <div className="border-t">
                <p className="text-xs font-medium text-muted-foreground px-4 pt-2.5 pb-1 uppercase tracking-wide">
                  Added Letter Writers ({recoLetters.length})
                </p>
                {recoLetters.map((rl: any) => (
                  <div key={rl.id} className="flex items-center gap-3 px-4 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{rl.name}</p>
                      <p className="text-xs text-muted-foreground">{rl.title}{rl.org ? ` · ${rl.org}` : ""}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{rl.relationship}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── ChecklistItem ────────────────────────────────────────────────────────────

function ChecklistItem({
  label, complete, detail, driveUrl,
}: {
  label: string;
  complete: boolean;
  detail: string;
  driveUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0",
        complete ? "bg-green-100" : "bg-gray-100")}>
        {complete
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          : <div className="w-2 h-2 rounded-full bg-gray-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", complete ? "text-green-800" : "text-foreground")}>{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {!complete && driveUrl && (
        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
          onClick={() => window.open(driveUrl, "_blank")}>
          <Upload className="w-3 h-3 mr-1" />Upload to Drive
        </Button>
      )}
    </div>
  );
}

// ─── CompletenessChecklist ────────────────────────────────────────────────────

function CompletenessChecklist({
  criteria, docsByType, pkg, recoLetters, resume, visaPath,
}: {
  criteria: any[];
  docsByType: Record<string, any[]>;
  pkg: any;
  recoLetters: any[];
  resume: any;
  visaPath: string;
}) {
  const criteriaExhibitDocs = docsByType["criteria_exhibit"] ?? [];
  const uniqueCriteriaWithDocs = new Set(criteriaExhibitDocs.map((d) => d.criteriaCode));
  const criteriaComplete = uniqueCriteriaWithDocs.size;
  const criteriaTotal = criteria.length;

  const minRecoLetters = visaPath === "eb1a" ? 3 : 2;
  const recoCount = recoLetters.length;

  const items = [
    {
      label: "Criteria Exhibits",
      complete: criteriaComplete >= criteriaTotal && criteriaTotal > 0,
      detail: criteriaTotal === 0 ? "No criteria configured" : `${criteriaComplete} of ${criteriaTotal} complete`,
      driveUrl: criteria[0]?.driveUrl ?? null,
    },
    {
      label: "Cover Letter",
      complete: isDone(pkg?.coverLetterStatus),
      detail: isDone(pkg?.coverLetterStatus) ? "Generated" : isGenerating(pkg?.coverLetterStatus) ? "Generating…" : "Not yet generated",
      driveUrl: null,
    },
    {
      label: "Personal Declaration",
      complete: isDone(pkg?.personalDeclarationStatus),
      detail: isDone(pkg?.personalDeclarationStatus) ? "Generated" : isGenerating(pkg?.personalDeclarationStatus) ? "Generating…" : "Not yet generated",
      driveUrl: null,
    },
    {
      label: "Field of Significance Brief",
      complete: isDone(pkg?.fieldBriefStatus),
      detail: isDone(pkg?.fieldBriefStatus) ? "Generated" : isGenerating(pkg?.fieldBriefStatus) ? "Generating…" : "Not yet generated",
      driveUrl: null,
    },
    {
      label: "Recommendation Letters",
      complete: recoCount >= minRecoLetters,
      detail: `${recoCount} uploaded — minimum ${minRecoLetters} required for ${visaPath.toUpperCase().replace("EB1A", "EB-1A")}`,
      driveUrl: null,
    },
    {
      label: "CV / Résumé",
      complete: !!resume,
      detail: resume ? `${resume.fileName ?? "Uploaded"} · ${resume.extractionStatus ?? ""}` : "Not uploaded",
      driveUrl: null,
    },
    {
      label: "Academic Credentials",
      complete: false,
      detail: "Upload diplomas and transcripts to Drive",
      driveUrl: null,
    },
    {
      label: "Credential Evaluation",
      complete: false,
      detail: "Required if any degree is from a foreign institution",
      driveUrl: null,
    },
    {
      label: "Demographic / Identity Documents",
      complete: false,
      detail: "Passport copy, I-94, visa stamp pages",
      driveUrl: null,
    },
  ];

  const completedCount = items.filter((i) => i.complete).length;
  const pct = Math.round((completedCount / items.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Petition Completeness Checklist</CardTitle>
          <span className="text-lg font-bold text-[#1E2D6B]">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-[#1E2D6B] rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{completedCount} of {items.length} items complete</p>
      </CardHeader>
      <CardContent className="p-0 px-4">
        {items.map((item) => (
          <ChecklistItem key={item.label} {...item} />
        ))}
      </CardContent>
    </Card>
  );
}

// ─── ExhibitsTab (main export) ────────────────────────────────────────────────

export function ExhibitsTab({ userId, profileData }: { userId: string; profileData: any }) {
  const [caseSetupId, setCaseSetupId] = useState<number | null>(null);
  const [setup, setSetup] = useState<any>(null);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [recoLetters, setRecoLetters] = useState<any[]>([]);
  const [docsByType, setDocsByType] = useState<Record<string, any[]>>({});
  const [pkg, setPkg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [noCase, setNoCase] = useState(false);
  const [publishBusy, setPublishBusy] = useState<Record<number, boolean>>({});
  const [genBusy, setGenBusy] = useState<Record<string, boolean>>({});

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load status ─────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async (csId: number) => {
    try {
      const r = await staffFetch(`/cases/${csId}/exhibits/status`);
      if (!r.ok) return;
      const d = await r.json();
      setDocsByType(d.exhibitDocumentsByType ?? {});
      setPkg(d.petitionPackage ?? null);
    } catch { /* swallow */ }
  }, []);

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await staffFetch(`/internal/petition/setup/${userId}`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const first = d.cases?.[0];
        if (!first?.setup) { setNoCase(true); return; }
        const sid = first.setup.id;
        setCaseSetupId(sid);
        setSetup(first.setup);
        setCriteria(first.exhibits ?? []);
        setRecoLetters(first.recoLetters ?? []);
        await loadStatus(sid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, loadStatus]);

  // ── Polling ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!caseSetupId) return;
    pollRef.current = setInterval(() => loadStatus(caseSetupId), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [caseSetupId, loadStatus]);

  // ── Toggle publish ───────────────────────────────────────────────────────────

  const togglePublish = useCallback(async (id: number, publish: boolean) => {
    if (!caseSetupId) return;
    setPublishBusy((p) => ({ ...p, [id]: true }));
    try {
      const r = await staffFetch(
        `/cases/${caseSetupId}/exhibits/${id}/${publish ? "publish" : "unpublish"}`,
        { method: "PATCH" },
      );
      if (r.ok) {
        const d = await r.json();
        if (d.exhibit) {
          setDocsByType((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              next[key] = next[key].map((doc) => doc.id === id ? d.exhibit : doc);
            }
            return next;
          });
        }
      }
    } finally {
      setPublishBusy((p) => ({ ...p, [id]: false }));
    }
  }, [caseSetupId]);

  // ── Regenerate ───────────────────────────────────────────────────────────────

  const regenerate = useCallback((docType: string, criteriaCode?: string) => {
    if (!caseSetupId) return;
    const pathMap: Record<string, string> = {
      criteria_exhibit: criteriaCode ? `criteria/${criteriaCode}` : "",
      exhibit_index: criteriaCode ? `criteria/${criteriaCode}` : "",
      sub_exhibit: criteriaCode ? `criteria/${criteriaCode}` : "",
      cover_letter: "cover-letter",
      personal_declaration: "personal-declaration",
      field_brief: "field-brief",
      reco_template: "recommendation-templates",
    };
    const path = pathMap[docType];
    if (!path) return;
    const key = criteriaCode ? `criteria_${criteriaCode}` : docType;
    setGenBusy((p) => ({ ...p, [key]: true }));
    staffFetch(`/cases/${caseSetupId}/exhibits/generate/${path}`, { method: "POST" })
      .finally(() => setTimeout(() => setGenBusy((p) => ({ ...p, [key]: false })), 10_000));
  }, [caseSetupId]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-200 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (noCase || !caseSetupId) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-muted-foreground text-sm">No petition setup found. Create one in the Petition Workspace tab first.</p>
        </CardContent>
      </Card>
    );
  }

  const visaPath = setup?.visaPath ?? "eb1a";

  return (
    <div className="space-y-6">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <GenerationPanel
          caseSetupId={caseSetupId}
          criteria={criteria}
          pkg={pkg}
          busy={genBusy}
          setBusy={setGenBusy}
        />
        <DocumentLibrary
          caseSetupId={caseSetupId}
          criteria={criteria}
          docsByType={docsByType}
          recoLetters={recoLetters}
          onTogglePublish={togglePublish}
          publishBusy={publishBusy}
          onRegenerate={regenerate}
        />
      </div>

      {/* Completeness checklist */}
      <CompletenessChecklist
        criteria={criteria}
        docsByType={docsByType}
        pkg={pkg}
        recoLetters={recoLetters}
        resume={profileData?.resume ?? null}
        visaPath={visaPath}
      />
    </div>
  );
}
