import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput, combinePhone } from "@/components/ui/PhoneInput";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function EliteBlueprintApply() {
  const [, navigate] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneCountryCode: "+1",
    phone: "",
    current_role: "",
    company: "",
    field: "",
    target_visa: "",
    timeline: "",
    background: "",
    strongest_criteria: "",
    goal: "",
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disclaimerChecked) {
      setError("Please acknowledge the advisory disclaimer to continue.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const { phoneCountryCode, phone, ...rest } = form;
      const res = await fetch("/api/blueprint/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, phone: combinePhone(phoneCountryCode, phone), disclaimer_acknowledged: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Submission failed");
      }
      navigate("/elite-blueprint/submitted");
    } catch (err: any) {
      setError(err.message ?? "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-foreground mb-3">Apply for Elite Blueprint</h1>
            <p className="text-muted-foreground text-lg">
              Tell us about your background. We'll review your application and reach out within 48 hours.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name *</Label>
                    <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1" placeholder="Priya Mehta" required />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1" placeholder="priya@company.com" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <PhoneInput
                      countryCode={form.phoneCountryCode}
                      phone={form.phone}
                      onCountryCodeChange={(code) => set("phoneCountryCode", code)}
                      onPhoneChange={(v) => set("phone", v)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Target Visa *</Label>
                    <Select value={form.target_visa} onValueChange={(v) => set("target_visa", v)} required>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select visa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eb1a">EB-1A (Extraordinary Ability)</SelectItem>
                        <SelectItem value="eb2niw">EB-2 NIW (National Interest Waiver)</SelectItem>
                        <SelectItem value="o1a">O-1A (Nonimmigrant)</SelectItem>
                        <SelectItem value="unsure">Not sure yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Current Role *</Label>
                    <Input value={form.current_role} onChange={(e) => set("current_role", e.target.value)} className="mt-1" placeholder="Senior ML Engineer" required />
                  </div>
                  <div>
                    <Label>Company / Organization</Label>
                    <Input value={form.company} onChange={(e) => set("company", e.target.value)} className="mt-1" placeholder="Google" />
                  </div>
                </div>

                <div>
                  <Label>Field of Expertise *</Label>
                  <Input value={form.field} onChange={(e) => set("field", e.target.value)} className="mt-1" placeholder="Artificial Intelligence / Quantum Computing / Biotech" required />
                </div>

                <div>
                  <Label>Desired Timeline</Label>
                  <Select value={form.timeline} onValueChange={(v) => set("timeline", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="When do you want to file?" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asap">As soon as possible</SelectItem>
                      <SelectItem value="6_months">Within 6 months</SelectItem>
                      <SelectItem value="1_year">Within 1 year</SelectItem>
                      <SelectItem value="exploring">Still exploring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Professional Background *</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Describe your career, research, or professional achievements in 3–5 sentences.</p>
                  <Textarea
                    value={form.background}
                    onChange={(e) => set("background", e.target.value)}
                    rows={4}
                    className="mt-1"
                    placeholder="I'm a research scientist at... My work focuses on... I've published..."
                    required
                  />
                </div>

                <div>
                  <Label>Your Strongest EB-1A / NIW Criteria</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Which criteria do you believe you satisfy? (awards, publications, judging, critical role, etc.)</p>
                  <Textarea
                    value={form.strongest_criteria}
                    onChange={(e) => set("strongest_criteria", e.target.value)}
                    rows={3}
                    className="mt-1"
                    placeholder="I have strong evidence for: scholarly articles (12 publications), judging (reviewed for NeurIPS, ICML), and critical role (Lead Scientist at OpenAI)..."
                  />
                </div>

                <div>
                  <Label>What do you hope to achieve with Elite Blueprint?</Label>
                  <Textarea
                    value={form.goal}
                    onChange={(e) => set("goal", e.target.value)}
                    rows={2}
                    className="mt-1"
                    placeholder="I want a clear strategy and accountability to actually file within 6 months..."
                  />
                </div>

                <div className="border border-border rounded-lg p-4 bg-amber-50/50">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="disclaimer-check"
                      checked={disclaimerChecked}
                      onCheckedChange={(v) => setDisclaimerChecked(!!v)}
                      className="mt-0.5"
                    />
                    <label htmlFor="disclaimer-check" className="text-sm text-foreground leading-relaxed cursor-pointer">
                      I understand that Pinnacle³ is an advisory coaching service, not a law firm. Elite Blueprint advisors are not attorneys and do not provide legal advice. I will engage a licensed immigration attorney for all legal filing decisions.
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <Button type="submit" disabled={submitting || !disclaimerChecked} className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base">
                  {submitting ? "Submitting..." : "Submit Application"}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  We review all applications within 48 hours and will contact you at the email provided.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
