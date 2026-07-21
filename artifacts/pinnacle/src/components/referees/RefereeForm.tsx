/**
 * RefereeForm.tsx — Pinnacle³
 *
 * Shared referee intake form (client portal cards + staff modal both use this).
 * Container-agnostic: renders the three sections + actions; the parent decides
 * whether it lives in a card or a dialog.
 *
 *  1. Identity & Credentials
 *  2. Two Yes/No toggles (willingness, worked together)
 *  3. Contributions — checkboxes; checking one reveals a required details textarea
 *
 * Create → POST /cases/:caseId/referees ; Update → PUT /referees/:id.
 * CV upload → POST /referees/:id/cv (enabled once the referee is saved).
 */

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, FileText, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { COUNTRY_CODES } from "@/lib/countryCodes";
import { cn } from "@/lib/utils";

// ─── Types (mirror the API responses) ────────────────────────────────────────────

export interface RefereeContribution {
  id?: number;
  contributionTypeId: number;
  details: string;
  contributionTypeName?: string | null;
}

export interface Referee {
  id: number;
  caseId: number;
  fullName: string;
  title: string;
  organization: string;
  email: string;
  phone: string | null;
  country: string | null;
  degreeTypeId: number | null;
  fieldOfExpertise: string | null;
  profileUrl: string | null;
  cvDriveFileId: string | null;
  willingnessConfirmed: boolean;
  workedTogether: boolean;
  createdBy: string;
  degreeName?: string | null;
  contributions: RefereeContribution[];
}

export interface LookupItem {
  id: number;
  name: string;
}

type FetchFn = (path: string, opts?: RequestInit) => Promise<Response>;

interface RefereeFormProps {
  caseId: number;
  fetchFn: FetchFn;
  referee: Referee | null;
  degreeTypes: LookupItem[];
  contributionTypes: LookupItem[];
  onSaved: (referee: Referee) => void;
  onCancel?: () => void;
}

const NONE = "__none__";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Unique, sorted ISO country names.
const COUNTRIES = Array.from(new Set(COUNTRY_CODES.map((c) => c.country))).sort();

export function RefereeForm({
  caseId,
  fetchFn,
  referee,
  degreeTypes,
  contributionTypes,
  onSaved,
  onCancel,
}: RefereeFormProps) {
  const { toast } = useToast();

  const [fullName, setFullName] = useState(referee?.fullName ?? "");
  const [title, setTitle] = useState(referee?.title ?? "");
  const [organization, setOrganization] = useState(referee?.organization ?? "");
  const [email, setEmail] = useState(referee?.email ?? "");
  const [phone, setPhone] = useState(referee?.phone ?? "");
  const [country, setCountry] = useState(referee?.country ?? "");
  const [degreeTypeId, setDegreeTypeId] = useState<string>(
    referee?.degreeTypeId != null ? String(referee.degreeTypeId) : NONE,
  );
  const [fieldOfExpertise, setFieldOfExpertise] = useState(referee?.fieldOfExpertise ?? "");
  const [profileUrl, setProfileUrl] = useState(referee?.profileUrl ?? "");
  const [willingnessConfirmed, setWillingnessConfirmed] = useState(
    referee?.willingnessConfirmed ?? false,
  );
  const [workedTogether, setWorkedTogether] = useState(referee?.workedTogether ?? false);
  const [cvDriveFileId, setCvDriveFileId] = useState<string | null>(referee?.cvDriveFileId ?? null);

  // contributions keyed by type id → { checked, details }
  const [contribs, setContribs] = useState<Record<number, { checked: boolean; details: string }>>(
    () => {
      const init: Record<number, { checked: boolean; details: string }> = {};
      for (const ct of contributionTypes) init[ct.id] = { checked: false, details: "" };
      for (const c of referee?.contributions ?? []) {
        init[c.contributionTypeId] = { checked: true, details: c.details };
      }
      return init;
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const setContribChecked = (id: number, checked: boolean) =>
    setContribs((prev) => ({ ...prev, [id]: { ...prev[id], checked } }));
  const setContribDetails = (id: number, details: string) =>
    setContribs((prev) => ({ ...prev, [id]: { ...prev[id], details } }));

  const selectedContributions = useMemo(
    () =>
      Object.entries(contribs)
        .filter(([, v]) => v.checked)
        .map(([id, v]) => ({ contributionTypeId: Number(id), details: v.details.trim() })),
    [contribs],
  );

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Required";
    if (!title.trim()) e.title = "Required";
    if (!organization.trim()) e.organization = "Required";
    if (!email.trim()) e.email = "Required";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email";
    for (const c of selectedContributions) {
      if (!c.details) e[`contrib_${c.contributionTypeId}`] = "Details are required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) {
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        fullName: fullName.trim(),
        title: title.trim(),
        organization: organization.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        country: country || null,
        degreeTypeId: degreeTypeId === NONE ? null : Number(degreeTypeId),
        fieldOfExpertise: fieldOfExpertise.trim() || null,
        profileUrl: profileUrl.trim() || null,
        willingnessConfirmed,
        workedTogether,
        contributions: selectedContributions,
      };
      const path = referee ? `/referees/${referee.id}` : `/cases/${caseId}/referees`;
      const r = await fetchFn(path, {
        method: referee ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      const data = (await r.json()) as { referee: Referee };
      toast({ title: referee ? "Referee updated" : "Referee added" });
      onSaved(data.referee);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Save failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCvUpload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "CV must be a PDF", variant: "destructive" });
      return;
    }
    if (!referee) {
      toast({ title: "Save the referee first, then attach a CV" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetchFn(`/referees/${referee.id}/cv`, { method: "POST", body: form });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Upload failed");
      }
      const data = (await r.json()) as { cvDriveFileId: string; referee: Referee };
      setCvDriveFileId(data.cvDriveFileId);
      toast({ title: "CV uploaded" });
      onSaved(data.referee);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" /> {errors[key]}
      </p>
    ) : null;

  return (
    <div className="space-y-6">
      {/* ── Section 1: Identity & Credentials ─────────────────────────────── */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Identity &amp; Credentials
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Full name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className={cn(errors.fullName && "border-red-400")} />
            {fieldError("fullName")}
          </div>
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              className={cn(errors.title && "border-red-400")} />
            {fieldError("title")}
          </div>
          <div>
            <Label className="text-xs">Organization *</Label>
            <Input value={organization} onChange={(e) => setOrganization(e.target.value)}
              className={cn(errors.organization && "border-red-400")} />
            {fieldError("organization")}
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={cn(errors.email && "border-red-400")} />
            {fieldError("email")}
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Select value={country || NONE} onValueChange={(v) => setCountry(v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE}>—</SelectItem>
                {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Highest degree</Label>
            <Select value={degreeTypeId} onValueChange={setDegreeTypeId}>
              <SelectTrigger><SelectValue placeholder="Select a degree" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {degreeTypes.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Field of expertise</Label>
            <Input value={fieldOfExpertise} onChange={(e) => setFieldOfExpertise(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">LinkedIn / profile URL</Label>
            <Input value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://linkedin.com/in/…" />
          </div>
        </div>

        {/* CV upload */}
        <div>
          <Label className="text-xs">CV (PDF)</Label>
          <div className="flex items-center gap-2 mt-1">
            {cvDriveFileId ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                <FileText className="w-3.5 h-3.5" /> CV uploaded
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No CV attached</span>
            )}
            <label className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded border px-2 py-1 transition-colors",
              referee ? "border-[#1E2D6B]/30 text-[#1E2D6B] hover:bg-[#1E2D6B]/5" : "border-gray-200 text-gray-400 cursor-not-allowed",
            )}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {cvDriveFileId ? "Replace" : "Upload"} PDF
              <input type="file" accept="application/pdf" className="hidden" disabled={!referee || uploading}
                onChange={(e) => void handleCvUpload(e.target.files?.[0])} />
            </label>
            {!referee && <span className="text-[11px] text-muted-foreground">Save first to attach</span>}
          </div>
        </div>
      </section>

      {/* ── Section 2: Yes/No toggles ─────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label className="text-sm font-normal">Has this referee confirmed willingness to provide a letter?</Label>
          <Switch checked={willingnessConfirmed} onCheckedChange={setWillingnessConfirmed} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label className="text-sm font-normal">Have you worked together directly?</Label>
          <Switch checked={workedTogether} onCheckedChange={setWorkedTogether} />
        </div>
      </section>

      {/* ── Section 3: Contributions ──────────────────────────────────────── */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Contributions this referee can speak to
        </h4>
        <div className="space-y-2">
          {contributionTypes.map((ct) => {
            const state = contribs[ct.id] ?? { checked: false, details: "" };
            return (
              <div key={ct.id} className="rounded-md border px-3 py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={state.checked}
                    onCheckedChange={(c) => setContribChecked(ct.id, c === true)} />
                  <span className="text-sm">{ct.name}</span>
                </label>
                {state.checked && (
                  <div className="mt-2">
                    <Textarea
                      placeholder="Provide details"
                      value={state.details}
                      onChange={(e) => setContribDetails(ct.id, e.target.value)}
                      className={cn("min-h-[64px] resize-none text-sm", errors[`contrib_${ct.id}`] && "border-red-400")}
                    />
                    {fieldError(`contrib_${ct.id}`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        )}
        <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-1.5"
          onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {referee ? "Save changes" : "Save referee"}
        </Button>
      </div>
    </div>
  );
}
