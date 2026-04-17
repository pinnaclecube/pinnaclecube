import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChevronRight } from "lucide-react";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";

export default function InstantProfileInsightStart() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    field: "",
    target_visa: "",
    summary: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      localStorage.setItem("ipi_form", JSON.stringify(form));
      setTimeout(() => navigate("/instant-profile-insight/results"), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-[#1E2D6B]/10 text-[#1E2D6B] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Instant Profile Insight
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">Get your AI profile analysis</h1>
            <p className="text-muted-foreground">
              Tell us about your background and receive an instant AI-powered assessment of your EB-1A / NIW potential.
            </p>
          </div>

          <AIOutputBanner variant="analysis" />

          <Card className="mt-6">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name *</Label>
                    <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1" required placeholder="Priya Mehta" />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1" required placeholder="priya@company.com" />
                  </div>
                </div>
                <div>
                  <Label>Current Role *</Label>
                  <Input value={form.role} onChange={(e) => set("role", e.target.value)} className="mt-1" required placeholder="Senior ML Engineer" />
                </div>
                <div>
                  <Label>Field of Expertise *</Label>
                  <Input value={form.field} onChange={(e) => set("field", e.target.value)} className="mt-1" required placeholder="Artificial Intelligence" />
                </div>
                <div>
                  <Label>Target Visa</Label>
                  <Select value={form.target_visa} onValueChange={(v) => set("target_visa", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select visa type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eb1a">EB-1A</SelectItem>
                      <SelectItem value="eb2niw">EB-2 NIW</SelectItem>
                      <SelectItem value="o1a">O-1A</SelectItem>
                      <SelectItem value="unsure">Not sure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Professional Summary *</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">3–5 sentences about your career, achievements, and expertise.</p>
                  <Textarea
                    value={form.summary}
                    onChange={(e) => set("summary", e.target.value)}
                    rows={4}
                    className="mt-1"
                    required
                    placeholder="I'm a Lead Research Scientist at... I've published 12 papers in... My work has been featured in..."
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" disabled={loading} className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base">
                  {loading ? "Analyzing..." : <><Sparkles className="w-4 h-4 mr-2" /> Get My Insight Report</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
