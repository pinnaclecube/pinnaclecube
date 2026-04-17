import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  BookOpen, Zap, BarChart2, CheckCircle2, Users, Lock, ChevronRight
} from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Structured EB-1A / NIW Curriculum",
    description: "Expert-authored courses covering every aspect of the petition process — from understanding the legal standard to crafting compelling evidence narratives.",
  },
  {
    icon: Zap,
    title: "AI-Powered Personalized Learning",
    description: "Adaptive lessons that prioritize the modules most relevant to your profile, visa category, and documentation gaps.",
  },
  {
    icon: BarChart2,
    title: "Progress Tracking",
    description: "Visual dashboards track your completion across all courses and surface the highest-leverage actions to take next.",
  },
  {
    icon: CheckCircle2,
    title: "Criteria Deep-Dives",
    description: "Dedicated modules for each EB-1A / NIW criterion, with legal standards explained in plain language and real examples.",
  },
  {
    icon: Users,
    title: "Expert-Curated Content",
    description: "All content is reviewed for accuracy and alignment with current USCIS adjudication standards.",
  },
  {
    icon: Lock,
    title: "Lifetime Access",
    description: "Purchase once and keep access forever, including all future updates to the curriculum.",
  },
];

const MODULES = [
  "Introduction to EB-1A & NIW — What qualifies as 'extraordinary'",
  "The 10 Criteria Explained — Legal standards and how to satisfy them",
  "Evidence Strategy — Building a compelling, layered evidence portfolio",
  "Crafting Your Petitioner's Letter — Structure, tone, and key arguments",
  "Working With Attorneys — How to maximize your legal team's effectiveness",
  "The National Interest Waiver Framework — Prong-by-prong breakdown",
  "Common Denial Reasons — And how to avoid them",
  "Filing Timeline & Process — What to expect from submission to adjudication",
];

export default function ExcellenceLabMarketing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#1E2D6B]/5 via-white to-blue-50/40">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 bg-[#1E2D6B]/10 text-[#1E2D6B] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              Excellence Lab
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Master the EB-1A & NIW
              <span className="text-[#1E2D6B]"> petition process</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              A structured learning platform built for high-achieving professionals who want to understand their case deeply — not just delegate it.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/excellence-lab/checkout">
                <Button size="lg" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] text-lg px-8 h-14">
                  Get Access — $297
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg" className="text-lg h-14">
                  Create Free Account
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">One-time payment · Lifetime access · No subscription</p>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-white">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-4">Everything you need to understand your case</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">Built for engineers, scientists, and tech professionals navigating extraordinary ability petitions.</p>
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

        {/* Curriculum */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="container mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-4">What's included</h2>
            <p className="text-muted-foreground text-center mb-10">8 comprehensive modules covering the full petition lifecycle.</p>
            <div className="space-y-3">
              {MODULES.map((m, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-border">
                  <div className="w-8 h-8 rounded-full bg-[#1E2D6B] text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-foreground font-medium">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-[#1E2D6B]">
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Invest in understanding your case</h2>
            <p className="text-white/70 mb-8 text-lg">
              One-time payment. No hidden fees. Full access to all current and future course content.
            </p>
            <Link href="/excellence-lab/checkout">
              <Button size="lg" className="bg-white text-[#1E2D6B] hover:bg-gray-100 text-lg px-8 h-14 font-bold">
                Get Excellence Lab — $297 <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
            <p className="text-white/50 text-sm mt-4">Advisory coaching service. Not legal advice.</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
