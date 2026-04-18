import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, ChevronLeft, Upload, FileText, CheckCircle2, X } from "lucide-react";

const STEPS = [
  { id: 1, title: "About You", description: "Basic professional information" },
  { id: 2, title: "Your Work", description: "Role, field, and experience" },
  { id: 3, title: "Achievements", description: "Awards, publications, and recognition" },
  { id: 4, title: "Evidence", description: "Documentation readiness" },
  { id: 5, title: "Visa Goals", description: "Your immigration objective" },
  { id: 6, title: "Resume Upload", description: "Upload your CV to your secure workspace" },
];

export default function ReadinessIntake() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Resume upload state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState<{ fileName: string; driveFileUrl: string } | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "",
    email: user?.email ?? "",
    currentRole: "",
    company: "",
    country: "",
    education: "",
    fieldOfWork: "",
    yearsExperience: "",
    summary: "",
    describeWork: "",
    keyAchievements: "",
    publications: "",
    awards: "",
    media: "",
    judgingReviewing: "",
    leadershipRoles: "",
    memberships: "",
    salaryIndicators: "",
    documentationAvailable: "",
    evidenceOrganization: "",
    evidenceStorage: "",
    visaPath: "",
    timeline: "",
    currentGoal: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/intake", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.intake) {
            setForm((f) => ({
              ...f,
              ...Object.fromEntries(
                Object.entries(data.intake).filter(([k, v]) => k in f && v !== null && v !== undefined),
              ),
            }));
          }
          if (data.resume) {
            setResumeUploaded({ fileName: data.resume.fileName, driveFileUrl: data.resume.driveFileUrl });
          }
        }
      } catch {
        // ignore
      }
    };
    if (token) load();
  }, [token]);

  const saveStep = async () => {
    setSaving(true);
    try {
      await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
    } catch {
      toast({ title: "Could not save progress", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step < STEPS.length) {
      await saveStep();
      setStep((s) => s + 1);
    }
  };

  const prev = () => setStep((s) => Math.max(1, s - 1));

  const handleResumeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setResumeFile(file);
  };

  const uploadResume = async () => {
    if (!resumeFile) return;
    setResumeUploading(true);
    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      const res = await fetch("/api/intake/resume", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }
      const data = await res.json();
      setResumeUploaded({ fileName: data.resume.fileName, driveFileUrl: data.resume.driveFileUrl });
      setResumeFile(null);
      toast({ title: "Resume uploaded to your secure Drive workspace" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setResumeUploading(false);
    }
  };

  const complete = async () => {
    setCompleting(true);
    // Save step 5 data if we're on step 6 (no form data on step 6)
    if (step === STEPS.length) {
      // No form data to save on resume step, just complete
    } else {
      await saveStep();
    }
    try {
      const res = await fetch("/api/intake/complete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to complete");
      navigate("/dashboard");
    } catch {
      toast({ title: "Failed to complete intake", variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;
  const isLastStep = step === STEPS.length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="py-4 px-8 border-b bg-white">
        <Logo href="/" />
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Readiness Intake</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Step {step} of {STEPS.length} — {STEPS[step - 1].title}
                </p>
              </div>
              <span className="text-sm font-medium text-[#1E2D6B]">{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              {step === 1 && (
                <>
                  <StepHeader title="Tell us about yourself" description="This helps us personalize your experience." />
                  <Field label="Full Name" required>
                    <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Priya Mehta" />
                  </Field>
                  <Field label="Email" required>
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="priya@company.com" />
                  </Field>
                  <Field label="Country of Residence" required>
                    <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="United States" />
                  </Field>
                  <Field label="Highest Education Level">
                    <Select value={form.education} onValueChange={(v) => set("education", v)}>
                      <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
                        <SelectItem value="masters">Master's Degree</SelectItem>
                        <SelectItem value="phd">PhD / Doctorate</SelectItem>
                        <SelectItem value="postdoc">Postdoctoral</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <StepHeader title="Your professional background" description="Describe your current work and expertise." />
                  <Field label="Current Role / Title" required>
                    <Input value={form.currentRole} onChange={(e) => set("currentRole", e.target.value)} placeholder="Senior Machine Learning Engineer" />
                  </Field>
                  <Field label="Company / Organization">
                    <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Google" />
                  </Field>
                  <Field label="Field of Expertise" required>
                    <Input value={form.fieldOfWork} onChange={(e) => set("fieldOfWork", e.target.value)} placeholder="Artificial Intelligence / NLP" />
                  </Field>
                  <Field label="Years of Experience">
                    <Select value={form.yearsExperience} onValueChange={(v) => set("yearsExperience", v)}>
                      <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-3">0–3 years</SelectItem>
                        <SelectItem value="3-6">3–6 years</SelectItem>
                        <SelectItem value="6-10">6–10 years</SelectItem>
                        <SelectItem value="10+">10+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Professional Summary" description="2–4 sentences about your expertise and impact.">
                    <Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="I lead AI research at... My work focuses on..." rows={3} />
                  </Field>
                  <Field label="Describe what you do in simple terms" description="How would you explain your work to a non-expert?">
                    <Textarea value={form.describeWork} onChange={(e) => set("describeWork", e.target.value)} rows={3} placeholder="I build systems that..." />
                  </Field>
                </>
              )}

              {step === 3 && (
                <>
                  <StepHeader title="Your achievements and recognition" description="Be as specific as possible — this directly maps to EB-1A / NIW criteria." />
                  <Field label="Key Achievements & Impact" description="Major accomplishments with quantifiable results.">
                    <Textarea value={form.keyAchievements} onChange={(e) => set("keyAchievements", e.target.value)} rows={4} placeholder="Led development of X that impacted Y million users..." />
                  </Field>
                  <Field label="Publications" description="Peer-reviewed papers, books, technical reports.">
                    <Textarea value={form.publications} onChange={(e) => set("publications", e.target.value)} rows={3} placeholder="Author of 8 papers in NeurIPS, ACL, ICML..." />
                  </Field>
                  <Field label="Awards & Prizes" description="Nationally or internationally recognized awards.">
                    <Textarea value={form.awards} onChange={(e) => set("awards", e.target.value)} rows={2} placeholder="Best Paper Award at ACL 2023..." />
                  </Field>
                  <Field label="Media Coverage" description="Articles, interviews, or features about you or your work.">
                    <Textarea value={form.media} onChange={(e) => set("media", e.target.value)} rows={2} placeholder="Featured in TechCrunch, MIT Technology Review..." />
                  </Field>
                  <Field label="Judging / Reviewing" description="Peer review panels, grant committees, conference review boards.">
                    <Textarea value={form.judgingReviewing} onChange={(e) => set("judgingReviewing", e.target.value)} rows={2} placeholder="Reviewer for NeurIPS, ICML; NSF grant committee..." />
                  </Field>
                  <Field label="Leadership & Critical Roles" description="Senior leadership positions at organizations with distinguished reputations.">
                    <Textarea value={form.leadershipRoles} onChange={(e) => set("leadershipRoles", e.target.value)} rows={2} placeholder="Lead Research Scientist at OpenAI; Board Member of..." />
                  </Field>
                  <Field label="Professional Memberships" description="Membership in associations requiring outstanding achievements.">
                    <Textarea value={form.memberships} onChange={(e) => set("memberships", e.target.value)} rows={2} placeholder="Fellow of ACM, IEEE Senior Member..." />
                  </Field>
                  <Field label="Salary / Compensation Indicators" description="High salary relative to peers (not exact figures needed).">
                    <Textarea value={form.salaryIndicators} onChange={(e) => set("salaryIndicators", e.target.value)} rows={2} placeholder="Compensation significantly above median for my field..." />
                  </Field>
                </>
              )}

              {step === 4 && (
                <>
                  <StepHeader title="Evidence and documentation" description="Help us understand what documentation you currently have available." />
                  <Field label="What documentation do you have available?" description="Letters of recommendation, contracts, patents, pay stubs, publication PDFs, etc.">
                    <Textarea value={form.documentationAvailable} onChange={(e) => set("documentationAvailable", e.target.value)} rows={3} placeholder="I have: 3 recommendation letters from professors, PDF copies of 5 published papers..." />
                  </Field>
                  <Field label="How organized is your evidence?">
                    <Select value={form.evidenceOrganization} onValueChange={(v) => set("evidenceOrganization", v)}>
                      <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="very_organized">Very organized — most items located</SelectItem>
                        <SelectItem value="somewhat_organized">Somewhat organized — need to gather some items</SelectItem>
                        <SelectItem value="scattered">Scattered — will need significant work</SelectItem>
                        <SelectItem value="not_started">Haven't started gathering evidence</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Where do you currently store evidence?">
                    <Select value={form.evidenceStorage} onValueChange={(v) => set("evidenceStorage", v)}>
                      <SelectTrigger><SelectValue placeholder="Select storage" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google_drive">Google Drive</SelectItem>
                        <SelectItem value="dropbox">Dropbox</SelectItem>
                        <SelectItem value="local">Local computer</SelectItem>
                        <SelectItem value="email">Email / scattered</SelectItem>
                        <SelectItem value="nowhere">Not stored anywhere yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}

              {step === 5 && (
                <>
                  <StepHeader title="Your immigration goals" description="Tell us about your visa objectives and timeline." />
                  <Field label="Target Visa" required>
                    <Select value={form.visaPath} onValueChange={(v) => set("visaPath", v)}>
                      <SelectTrigger><SelectValue placeholder="Select visa type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eb1a">EB-1A (Extraordinary Ability)</SelectItem>
                        <SelectItem value="eb2niw">EB-2 NIW (National Interest Waiver)</SelectItem>
                        <SelectItem value="o1a">O-1A (Extraordinary Ability — Nonimmigrant)</SelectItem>
                        <SelectItem value="unsure">Not sure yet — need guidance</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Desired Timeline">
                    <Select value={form.timeline} onValueChange={(v) => set("timeline", v)}>
                      <SelectTrigger><SelectValue placeholder="Select timeline" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asap">As soon as possible</SelectItem>
                        <SelectItem value="6_months">Within 6 months</SelectItem>
                        <SelectItem value="1_year">Within 1 year</SelectItem>
                        <SelectItem value="1_2_years">1–2 years</SelectItem>
                        <SelectItem value="exploring">Just exploring for now</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Current Goal" description="What's your primary goal right now?">
                    <Select value={form.currentGoal} onValueChange={(v) => set("currentGoal", v)}>
                      <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assess_readiness">Assess my readiness</SelectItem>
                        <SelectItem value="gather_evidence">Start gathering evidence</SelectItem>
                        <SelectItem value="strengthen_profile">Strengthen my profile before filing</SelectItem>
                        <SelectItem value="ready_to_file">I'm ready to file and need petition support</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}

              {step === 6 && (
                <>
                  <StepHeader
                    title="Upload your resume / CV"
                    description="Your resume is securely stored in your private Google Drive workspace and used to personalize your analysis."
                  />

                  {resumeUploaded ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Resume uploaded successfully</p>
                          <p className="text-xs text-green-700 mt-0.5 font-mono">{resumeUploaded.fileName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={resumeUploaded.driveFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#1E2D6B] hover:underline font-medium"
                        >
                          View in Drive
                        </a>
                        <button
                          onClick={() => { setResumeUploaded(null); setResumeFile(null); }}
                          className="text-gray-400 hover:text-gray-600"
                          title="Replace file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleResumeSelect}
                        className="hidden"
                        id="resume-upload"
                      />

                      {resumeFile ? (
                        <div className="rounded-lg border border-border bg-muted/30 p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <FileText className="w-8 h-8 text-[#1E2D6B] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{resumeFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              onClick={() => setResumeFile(null)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <Button
                            onClick={uploadResume}
                            disabled={resumeUploading}
                            className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8]"
                          >
                            {resumeUploading ? "Uploading to Drive..." : "Upload to My Workspace"}
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <label
                            htmlFor="resume-upload"
                            className="flex flex-col items-center justify-center w-full border-2 border-dashed border-[#1E2D6B]/30 rounded-xl p-10 cursor-pointer hover:border-[#1E2D6B]/60 hover:bg-[#1E2D6B]/5 transition-colors"
                          >
                            <Upload className="w-10 h-10 text-[#1E2D6B]/50 mb-3" />
                            <p className="text-sm font-medium text-foreground mb-1">Click to select your resume</p>
                            <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, or TXT · Max 20 MB</p>
                          </label>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        Uploading a resume is optional — you can skip this step and complete it later from your profile.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={prev} disabled={step === 1}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            <div className="flex items-center gap-3">
              {isLastStep && !resumeUploaded && (
                <Button variant="ghost" onClick={complete} disabled={completing} className="text-muted-foreground">
                  Skip & Complete
                </Button>
              )}

              {!isLastStep ? (
                <Button onClick={next} disabled={saving} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                  {saving ? "Saving..." : "Next"} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={complete} disabled={completing} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                  {completing ? "Completing..." : resumeUploaded ? "Complete Intake" : "Complete Without Resume"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-2 border-b border-border">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function Field({
  label,
  required,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {description && <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">{description}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}
