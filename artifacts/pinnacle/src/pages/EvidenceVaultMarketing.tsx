import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/Navbar";
import { LegalFooterBar } from "@/components/disclaimers/LegalFooterBar";
import { Shield, FolderOpen, Sparkles, BarChart, FileCheck, Lock, ChevronRight } from "lucide-react";

const FEATURES = [
  {
    icon: FolderOpen,
    title: "Organized by EB-1A Criteria",
    description: "Evidence is automatically organized into the 10 EB-1A, 5 EB-2 NIW, and O-1A criteria folders — mirroring what USCIS expects.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Gap Analysis",
    description: "Our AI reviews your evidence portfolio and identifies which criteria need stronger documentation before you file.",
  },
  {
    icon: BarChart,
    title: "Readiness Scoring",
    description: "Real-time readiness scores for each criterion and an overall application strength score that updates as you upload.",
  },
  {
    icon: FileCheck,
    title: "Exhibit Labels & Cover Pages",
    description: "Generate formatted exhibit labels and cover pages for each document, formatted for legal filing.",
  },
  {
    icon: Shield,
    title: "Google Drive Integration",
    description: "Evidence is securely stored in your dedicated Google Drive folder — organized, backed up, and accessible to your attorney.",
  },
  {
    icon: Lock,
    title: "Secure & Private",
    description: "Your evidence is encrypted at rest. Only you and invited staff can access your documents.",
  },
];

const CRITERIA_PREVIEW = [
  "Awards & Prizes",
  "Memberships in Elite Associations",
  "Published Media About You",
  "Judging Others' Work",
  "Original Contributions",
  "Scholarly Articles",
  "Critical Role at Distinguished Org",
  "High Salary Indicators",
  "Commercial Success",
  "Exhibitions",
];

export default function EvidenceVaultMarketing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-br from-blue-900/5 via-white to-indigo-50/40">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 bg-[#1E2D6B]/10 text-[#1E2D6B] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              <Shield className="w-3.5 h-3.5" />
              Evidence Vault
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Your evidence,
              <span className="text-[#1E2D6B]"> petition-ready</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              The professional's tool for organizing, analyzing, and presenting immigration evidence. Built for the 10 EB-1A criteria, EB-2 NIW, and O-1A.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/evidence-vault/checkout">
                <Button size="lg" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] text-lg px-8 h-14">
                  Get Access — $497
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg" className="text-lg h-14">
                  Start Free
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">Includes Excellence Lab · One-time payment · Lifetime access</p>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-white">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-4">Purpose-built for immigration evidence</h2>
            <p className="text-muted-foreground text-center mb-12">Not a generic document tool. Every feature is built around how USCIS evaluates extraordinary ability.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <Card key={f.title} className="border-border hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="w-10 h-10 rounded-lg bg-[#1E2D6B]/10 flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5 text-[#1E2D6B]" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Criteria coverage */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold mb-4">Covers all 10 EB-1A criteria</h2>
            <p className="text-muted-foreground mb-10">Each criterion has its own organized folder, readiness score, and guidance.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CRITERIA_PREVIEW.map((c, i) => (
                <div key={i} className="bg-white rounded-lg border border-border p-3 text-sm font-medium text-foreground text-left flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-[#1E2D6B]/10 text-[#1E2D6B] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  {c}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-[#1E2D6B]">
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Build your petition-ready evidence vault</h2>
            <p className="text-white/70 mb-8 text-lg">
              Includes full Excellence Lab access. One-time payment.
            </p>
            <Link href="/evidence-vault/checkout">
              <Button size="lg" className="bg-white text-[#1E2D6B] hover:bg-gray-100 text-lg px-8 h-14 font-bold">
                Get Evidence Vault — $497 <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
            <p className="text-white/50 text-sm mt-4">Advisory coaching service. AI outputs require attorney review.</p>
          </div>
        </section>
      </main>
      <LegalFooterBar />
    </div>
  );
}
