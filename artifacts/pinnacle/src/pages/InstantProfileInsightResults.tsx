import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { LegalFooterBar } from "@/components/disclaimers/LegalFooterBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { Sparkles, ChevronRight, AlertTriangle } from "lucide-react";

interface ProfileForm {
  name: string;
  email: string;
  role: string;
  field: string;
  target_visa: string;
  summary: string;
}

const SAMPLE_INSIGHTS = [
  {
    criterion: "Scholarly Contributions",
    status: "strong",
    note: "Professionals in technical fields often have strong publication records. Ensure you have PDFs and citation counts ready.",
  },
  {
    criterion: "Critical Role",
    status: "developing",
    note: "Your title suggests leadership — gather letters and org charts to document your role at a distinguished organization.",
  },
  {
    criterion: "Original Contributions",
    status: "strong",
    note: "Research contributions with real-world deployment are highly persuasive. Document measurable impact.",
  },
  {
    criterion: "Awards & Prizes",
    status: "weak",
    note: "Consider applying for industry recognition awards and conference best-paper prizes before filing.",
  },
  {
    criterion: "Judging Others",
    status: "developing",
    note: "Sign up as a reviewer for major conferences in your field. Document invitations and participation.",
  },
];

const statusColor: Record<string, string> = {
  strong: "bg-green-100 text-green-800",
  developing: "bg-amber-100 text-amber-800",
  weak: "bg-red-100 text-red-800",
};

export default function InstantProfileInsightResults() {
  const [profile, setProfile] = useState<ProfileForm | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ipi_form");
    if (stored) setProfile(JSON.parse(stored));
  }, []);

  const visaLabel = profile?.target_visa === "eb1a" ? "EB-1A" : profile?.target_visa === "eb2niw" ? "EB-2 NIW" : profile?.target_visa === "o1a" ? "O-1A" : "EB-1A / NIW";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Insight Report Ready
            </div>
            {profile && (
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {visaLabel} Profile Insight for {profile.name}
              </h1>
            )}
            <p className="text-muted-foreground">AI-generated assessment based on your submitted information</p>
          </div>

          <AIOutputBanner variant="analysis" />

          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Overall Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">
                  Based on your profile as a <strong>{profile?.role ?? "professional"}</strong> in <strong>{profile?.field ?? "your field"}</strong>, you have a promising foundation for a {visaLabel} petition. The key focus areas are building evidence across 3–5 criteria with substantive documentation that demonstrates both your distinction and your impact in the field.
                </p>
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    This is an AI-generated analysis based on limited information. It is not a legal assessment and should not be used as the basis for filing decisions. Consult a licensed immigration attorney.
                  </p>
                </div>
              </CardContent>
            </Card>

            <h2 className="text-xl font-bold text-foreground mt-8 mb-4">Criteria Analysis</h2>
            {SAMPLE_INSIGHTS.map((insight) => (
              <Card key={insight.criterion} className="overflow-hidden">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{insight.criterion}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{insight.note}</p>
                    </div>
                    <Badge className={`${statusColor[insight.status]} border-0 shrink-0`}>
                      {insight.status.charAt(0).toUpperCase() + insight.status.slice(1)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="bg-[#1E2D6B] rounded-xl p-8 text-center mt-10">
              <h2 className="text-2xl font-bold text-white mb-3">Ready to build your case?</h2>
              <p className="text-white/70 mb-6">Create a free account and start organizing your evidence in the Evidence Vault.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/register">
                  <Button className="bg-white text-[#1E2D6B] hover:bg-gray-100 font-bold">
                    Create Free Account <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                <Link href="/elite-blueprint/apply">
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    Apply for Elite Blueprint
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <LegalFooterBar />
    </div>
  );
}
