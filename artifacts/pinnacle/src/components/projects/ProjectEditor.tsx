/**
 * ProjectEditor.tsx — Pinnacle³
 *
 * Shared 9-section project documentation editor (client portal + staff portal
 * both use it — each passes its own `fetchFn`). Sections render as an accordion;
 * each section has its own Save button, saved/unsaved indicator, and a completion
 * check. Section 1 uses structured inputs (dates, dropdowns, Ongoing toggle);
 * Sections 2–9 are guided textareas. Evidence documents live below the accordion.
 *
 * Update → PUT /projects/:id (partial — only the saved section's fields).
 */

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { Loader2, Check, Circle, ArrowLeft, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ProjectDocuments, type ProjectDocument, type LookupItem } from "./ProjectDocuments";

// ─── Types (mirror the API) ──────────────────────────────────────────────────────

export interface ProjectCompletion {
  sections: Record<string, boolean>;
  complete: number;
  total: number;
}

export interface Project {
  id: number;
  caseId: number;
  sortOrder: number;
  isLocked: boolean;
  createdBy: string;
  // Section 1
  title: string;
  organization: string | null;
  industryDomain: string | null;
  startDate: string | null;
  endDate: string | null;
  isOngoing: boolean;
  roleTitle: string | null;
  employmentTypeId: number | null;
  teamComposition: string | null;
  summary: string | null;
  criticalityId: number | null;
  criticalityJustification: string | null;
  regulatoryContext: string | null;
  // Sections 2–9 (all nullable text)
  problemBefore: string | null;
  baselineMetrics: string | null;
  constraintsRisks: string | null;
  failureConsequences: string | null;
  whyChosen: string | null;
  decisionAuthority: string | null;
  stakeholdersInfluenced: string | null;
  criticalEventsLed: string | null;
  indispensabilityEvidence: string | null;
  leadershipOutcomes: string | null;
  originalIdea: string | null;
  approachDifference: string | null;
  originalityProof: string | null;
  contributionReach: string | null;
  downstreamImpact: string | null;
  beforeAfterMetrics: string | null;
  revenueCostSavings: string | null;
  adoptionMetrics: string | null;
  evidenceNotes: string | null;
  testimonials: string | null;
  pressRecognition: string | null;
  awardsCommendations: string | null;
  strategicImportance: string | null;
  architectureMethods: string | null;
  alternativesInferior: string | null;
  reproducibility: string | null;
  ipStatus: string | null;
  externalUsers: string | null;
  adoptionEvidence: string | null;
  academicCitations: string | null;
  talksInvitations: string | null;
  uniquenessVsPeers: string | null;
  measurableDifferences: string | null;
  expertiseScarcity: string | null;
  documents: ProjectDocument[];
  completion: ProjectCompletion;
}

type FetchFn = (path: string, opts?: RequestInit) => Promise<Response>;

const NONE = "__none__";

type FieldDef = { key: keyof Project; label: string; helper?: string };

// Section 1 keys (for dirty detection). Section 1 is rendered with custom inputs.
const SECTION1_KEYS: (keyof Project)[] = [
  "title", "organization", "industryDomain", "startDate", "endDate", "isOngoing",
  "roleTitle", "employmentTypeId", "teamComposition", "summary",
  "criticalityId", "criticalityJustification", "regulatoryContext",
];

// Sections 2–9: guided textareas. Label = the question; helper = spec parenthetical.
const TEXT_SECTIONS: { id: string; title: string; fields: FieldDef[] }[] = [
  {
    id: "section2", title: "2 · Problem, Baseline & Stakes",
    fields: [
      { key: "problemBefore", label: "What was the business/technical problem before your involvement?" },
      { key: "baselineMetrics", label: "What were the baseline metrics?", helper: "KPIs, time period, data source BEFORE the work" },
      { key: "constraintsRisks", label: "What constraints and risks applied?", helper: "budget, timeline, compliance" },
      { key: "failureConsequences", label: "What were the consequences of failure?", helper: "what if it had failed or never shipped" },
    ],
  },
  {
    id: "section3", title: "3 · Leadership & Critical Role",
    fields: [
      { key: "whyChosen", label: "Why were you chosen for this role?", helper: "selection process, nomination reason" },
      { key: "decisionAuthority", label: "What decision authority did you hold?", helper: "budget, hiring, roadmap, vendor" },
      { key: "stakeholdersInfluenced", label: "Which stakeholders did you influence?", helper: "executives, clients, partners" },
      { key: "criticalEventsLed", label: "What critical events did you lead?", helper: "launches, audits, incidents" },
      { key: "indispensabilityEvidence", label: "What evidence shows you were indispensable?", helper: "commendations, escalations, recognition" },
      { key: "leadershipOutcomes", label: "What leadership outcomes resulted?", helper: "quantified: on-time delivery, team productivity" },
    ],
  },
  {
    id: "section4", title: "4 · Original Contribution",
    fields: [
      { key: "originalIdea", label: "What original idea, design, or method did you introduce?" },
      { key: "approachDifference", label: "How did it differ from / was superior to existing methods?" },
      { key: "originalityProof", label: "What proves its originality?", helper: "docs, patents, internal RFCs, presentations" },
      { key: "contributionReach", label: "Where else is it used?", helper: "other teams, clients, industry" },
      { key: "downstreamImpact", label: "What downstream impact did it have?", helper: "revenue, performance, users, citations" },
    ],
  },
  {
    id: "section5", title: "5 · Quantitative Impact",
    fields: [
      { key: "beforeAfterMetrics", label: "Before vs. after metrics", helper: "accuracy, cost, time, reliability" },
      { key: "revenueCostSavings", label: "Revenue / cost savings", helper: "$ or %" },
      { key: "adoptionMetrics", label: "Adoption metrics", helper: "# users, # orgs, DAU/MAU, efficiency gains" },
      { key: "evidenceNotes", label: "What evidence exists, and where?", helper: "uploads go in the Evidence Documents section below" },
    ],
  },
  {
    id: "section6", title: "6 · Qualitative Impact & Recognition",
    fields: [
      { key: "testimonials", label: "Testimonials", helper: "client/executive quotes, emails" },
      { key: "pressRecognition", label: "Press / recognition", helper: "links, public mentions" },
      { key: "awardsCommendations", label: "Awards & commendations" },
      { key: "strategicImportance", label: "Strategic importance", helper: "enabled deals, contracts, partnerships" },
    ],
  },
  {
    id: "section7", title: "7 · Technical Depth",
    fields: [
      { key: "architectureMethods", label: "Architecture, methods, and algorithms used" },
      { key: "alternativesInferior", label: "Why were alternative approaches inferior?" },
      { key: "reproducibility", label: "Reproducibility", helper: "datasets, parameters, scripts" },
      { key: "ipStatus", label: "IP status", helper: "patent filed/granted, open-source, trade secret" },
    ],
  },
  {
    id: "section8", title: "8 · External Adoption & Citations",
    fields: [
      { key: "externalUsers", label: "Who outside your team/company uses the work?" },
      { key: "adoptionEvidence", label: "Adoption evidence", helper: "integration PRs, case studies, invoices" },
      { key: "academicCitations", label: "Academic citations", helper: "list with sources" },
      { key: "talksInvitations", label: "Talks & invitations", helper: "event, organizer, audience" },
    ],
  },
  {
    id: "section9", title: "9 · Comparative Positioning",
    fields: [
      { key: "uniquenessVsPeers", label: "Uniqueness vs. peers" },
      { key: "measurableDifferences", label: "Measurable differences", helper: "accuracy, speed, cost, adoption" },
      { key: "expertiseScarcity", label: "Why is the expertise scarce / hard to replace?" },
    ],
  },
];

type Values = Record<string, string | boolean>;

function toValues(p: Project): Values {
  const v: Values = {};
  for (const [k, val] of Object.entries(p)) {
    if (k === "documents" || k === "completion") continue;
    if (k === "isOngoing") v[k] = Boolean(val);
    else if (k === "employmentTypeId" || k === "criticalityId") v[k] = val != null ? String(val) : NONE;
    else v[k] = val == null ? "" : String(val);
  }
  return v;
}

export function ProjectEditor({
  project, fetchFn, employmentTypes, criticalityLevels, categories, onBack, onChange,
}: {
  project: Project;
  fetchFn: FetchFn;
  employmentTypes: LookupItem[];
  criticalityLevels: LookupItem[];
  categories: LookupItem[];
  onBack: () => void;
  onChange: (updated: Project) => void;
}) {
  const { toast } = useToast();
  const [values, setValues] = useState<Values>(() => toValues(project));
  const [saved, setSaved] = useState<Values>(() => toValues(project));
  const [completion, setCompletion] = useState<ProjectCompletion>(project.completion);
  const [documents, setDocuments] = useState<ProjectDocument[]>(project.documents ?? []);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const set = (key: keyof Project, v: string | boolean) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const sectionKeys = (sectionId: string): (keyof Project)[] =>
    sectionId === "section1"
      ? SECTION1_KEYS
      : (TEXT_SECTIONS.find((s) => s.id === sectionId)?.fields.map((f) => f.key) ?? []);

  const isDirty = (sectionId: string) =>
    sectionKeys(sectionId).some((k) => values[k as string] !== saved[k as string]);

  function buildPayload(sectionId: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const key of sectionKeys(sectionId)) {
      const v = values[key as string];
      if (key === "isOngoing") payload[key] = Boolean(v);
      else if (key === "employmentTypeId" || key === "criticalityId")
        payload[key] = v === NONE || v === "" ? null : Number(v);
      else payload[key] = v;
    }
    return payload;
  }

  async function saveSection(sectionId: string) {
    if (sectionId === "section1" && !String(values.title ?? "").trim()) {
      toast({ title: "A project title is required", variant: "destructive" });
      return;
    }
    setSavingSection(sectionId);
    try {
      const r = await fetchFn(`/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(sectionId)),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Save failed");
      const updated = d.project as Project;
      setCompletion(updated.completion);
      // Refresh the saved snapshot for this section's keys from the server echo.
      const fresh = toValues(updated);
      setSaved((prev) => {
        const next = { ...prev };
        for (const k of sectionKeys(sectionId)) next[k as string] = fresh[k as string];
        return next;
      });
      setValues((prev) => {
        const next = { ...prev };
        for (const k of sectionKeys(sectionId)) next[k as string] = fresh[k as string];
        return next;
      });
      onChange(updated);
      toast({ title: "Section saved" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSavingSection(null);
    }
  }

  function updateDocuments(docs: ProjectDocument[]) {
    setDocuments(docs);
    onChange({ ...project, documents: docs, completion });
  }

  const sectionBadge = (sectionId: string) => {
    const complete = completion.sections[sectionId];
    const dirty = isDirty(sectionId);
    return (
      <span className="flex items-center gap-2 ml-auto mr-2">
        {dirty && <span className="text-[10px] font-medium text-amber-600">Unsaved</span>}
        {complete ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Circle className="w-4 h-4 text-gray-300" />
        )}
      </span>
    );
  };

  const SaveButton = ({ sectionId }: { sectionId: string }) => (
    <div className="flex justify-end pt-1">
      <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5"
        disabled={!isDirty(sectionId) || savingSection !== null}
        onClick={() => void saveSection(sectionId)}>
        {savingSection === sectionId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        Save section
      </Button>
    </div>
  );

  const empType = String(values.employmentTypeId ?? NONE);
  const critLevel = String(values.criticalityId ?? NONE);

  const title = useMemo(() => String(values.title ?? "").trim() || "Untitled project", [values.title]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Back to projects
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {completion.complete} of {completion.total} sections complete
        </div>
      </div>
      <h2 className="text-lg font-bold truncate">{title}</h2>

      <Accordion type="multiple" defaultValue={["section1"]} className="rounded-lg border divide-y">
        {/* ── Section 1 — Project Snapshot (structured) ───────────────────────── */}
        <AccordionItem value="section1" className="border-b-0 px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">1 · Project Snapshot</span>
            {sectionBadge("section1")}
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Project title *</Label>
                <Input value={String(values.title ?? "")} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Organization</Label>
                <Input value={String(values.organization ?? "")} onChange={(e) => set("organization", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Industry / domain</Label>
                <Input value={String(values.industryDomain ?? "")} onChange={(e) => set("industryDomain", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Your role / title</Label>
                <Input value={String(values.roleTitle ?? "")} onChange={(e) => set("roleTitle", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Employment type</Label>
                <Select value={empType} onValueChange={(v) => set("employmentTypeId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {employmentTypes.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={String(values.startDate ?? "")} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">End date</Label>
                <Input type="date" value={String(values.endDate ?? "")} disabled={Boolean(values.isOngoing)}
                  onChange={(e) => set("endDate", e.target.value)} />
                <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                  <Checkbox checked={Boolean(values.isOngoing)}
                    onCheckedChange={(c) => { set("isOngoing", c === true); if (c === true) set("endDate", ""); }} />
                  <span className="text-xs text-muted-foreground">Ongoing</span>
                </label>
              </div>
              <div>
                <Label className="text-xs">Criticality</Label>
                <Select value={critLevel} onValueChange={(v) => set("criticalityId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {criticalityLevels.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Summary</Label>
              <p className="text-[11px] text-muted-foreground mb-1">1–2 line brief</p>
              <Textarea value={String(values.summary ?? "")} onChange={(e) => set("summary", e.target.value)}
                className="min-h-[56px] resize-none text-sm" />
            </div>
            <div>
              <Label className="text-xs">Team composition</Label>
              <p className="text-[11px] text-muted-foreground mb-1">size, direct reports, cross-functional</p>
              <Textarea value={String(values.teamComposition ?? "")} onChange={(e) => set("teamComposition", e.target.value)}
                className="min-h-[56px] resize-none text-sm" />
            </div>
            <div>
              <Label className="text-xs">Criticality justification</Label>
              <Textarea value={String(values.criticalityJustification ?? "")} onChange={(e) => set("criticalityJustification", e.target.value)}
                className="min-h-[56px] resize-none text-sm" />
            </div>
            <div>
              <Label className="text-xs">Regulatory context</Label>
              <p className="text-[11px] text-muted-foreground mb-1">HIPAA, GDPR, FDA, etc.</p>
              <Textarea value={String(values.regulatoryContext ?? "")} onChange={(e) => set("regulatoryContext", e.target.value)}
                className="min-h-[56px] resize-none text-sm" />
            </div>
            <SaveButton sectionId="section1" />
          </AccordionContent>
        </AccordionItem>

        {/* ── Sections 2–9 — guided textareas ─────────────────────────────────── */}
        {TEXT_SECTIONS.map((section) => (
          <AccordionItem key={section.id} value={section.id} className="border-b-0 px-4">
            <AccordionTrigger className="hover:no-underline">
              <span className="font-semibold">{section.title}</span>
              {sectionBadge(section.id)}
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {section.fields.map((f) => (
                <div key={f.key as string}>
                  <Label className="text-xs">{f.label}</Label>
                  {f.helper && <p className="text-[11px] text-muted-foreground mb-1">{f.helper}</p>}
                  <Textarea
                    value={String(values[f.key as string] ?? "")}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="min-h-[72px] resize-y text-sm mt-1"
                  />
                </div>
              ))}
              <SaveButton sectionId={section.id} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* ── Evidence Documents ──────────────────────────────────────────────── */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-muted-foreground" /> Evidence Documents
        </h3>
        <ProjectDocuments
          projectId={project.id}
          fetchFn={fetchFn}
          categories={categories}
          documents={documents}
          onChange={updateDocuments}
        />
      </div>
    </div>
  );
}
