import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ContactHeroForm } from "@/components/ContactHeroForm";
import { BookOpen, Zap, BarChart2, CheckCircle2, Users, Lock } from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Criterion-by-Criterion Playbooks",
    description: "Every EB-1A and NIW criterion has its own dedicated module — with the legal standard explained in plain English, real examples from approved petitions, and step-by-step guidance on how to satisfy it.",
  },
  {
    icon: Zap,
    title: "Frameworks You Can Act On Today",
    description: "Not theory. Concrete templates, outreach scripts, and positioning frameworks for securing media coverage, peer review roles, and advisory board seats.",
  },
  {
    icon: BarChart2,
    title: "Progress Tracking",
    description: "Visual dashboards surface the modules most relevant to your profile and track your progress through each criterion — so you always know what to focus on next.",
  },
  {
    icon: CheckCircle2,
    title: "Written for Engineers & Scientists",
    description: "The immigration system was not designed with technical professionals in mind. We bridge that gap — translating academic impact, technical leadership, and product influence into USCIS language.",
  },
  {
    icon: Users,
    title: "Vetted by Advisory Professionals",
    description: "Every module is reviewed for accuracy and alignment with current USCIS adjudication standards. You learn what actually works — not outdated advice from forums.",
  },
  {
    icon: Lock,
    title: "Yours Forever",
    description: "One payment. Lifetime access. Every update to the curriculum is included — because immigration policy evolves, and so should your knowledge.",
  },
];

const MODULES = [
  "Understanding 'Extraordinary Ability' — What it actually means for your career",
  "The 10 EB-1A Criteria — Plain-English standards and how to satisfy them",
  "Evidence Strategy — Building a portfolio that tells a coherent story",
  "The National Interest Waiver — A prong-by-prong framework",
  "Getting Media Coverage — A step-by-step outreach strategy that works",
  "Peer Review & Judging — How to find, request, and document these opportunities",
  "Crafting Your Petitioner's Letter — Structure, tone, and the arguments that matter",
  "Working With Your Attorney — How to make their job easier and your case stronger",
];

export default function ExcellenceLabMarketing() {
  return (
    <PublicLayout>
      {/* Hero — h-svh 70/30 split matching Home page */}
      <section className="relative h-svh bg-[#1E2D6B] overflow-hidden flex flex-col">
        {/* Background image */}
        <div className="absolute inset-0 opacity-[0.18] pointer-events-none mix-blend-overlay">
          <img src="/bold-ascent-hero.png" alt="" className="w-full h-full object-cover object-center" />
        </div>
        {/* Decorative ³ */}
        <div className="absolute right-[32%] -bottom-16 text-[400px] font-black text-white/[0.025] leading-none pointer-events-none select-none hidden lg:block">³</div>

        {/* 70 / 30 split */}
        <div className="flex-1 flex flex-col lg:flex-row lg:items-center max-w-[1280px] mx-auto w-full px-6 pt-24 pb-8 gap-8 relative z-10 min-h-0">

          {/* Left — product content (70%) */}
          <div className="flex flex-col lg:w-[70%] lg:pr-10">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-5 w-fit">
              <BookOpen className="w-3.5 h-3.5" />
              Excellence Lab
            </div>
            <h1 className="text-[clamp(2rem,4.5vw,52px)] font-extrabold text-white leading-[1.05] tracking-tight mb-2">
              You have the achievements.
            </h1>
            <h2 className="text-[clamp(2rem,4.5vw,52px)] font-extrabold text-[#F59E0B] leading-[1.05] tracking-tight mb-5">
              Let's make USCIS see them.
            </h2>
            <p className="text-[clamp(0.9rem,1.4vw,17px)] text-white/70 font-medium mb-7 max-w-xl leading-relaxed">
              You've published research, led significant projects, and built things that matter. The Excellence Lab teaches you how to present that career in the exact language USCIS requires — so nothing you've done gets overlooked.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <Link href="/excellence-lab/checkout">
                <button className="bg-white text-[#1E2D6B] px-6 py-3 rounded font-extrabold text-sm hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-black/10 w-full sm:w-auto">
                  Get Access — $249
                </button>
              </Link>
              <Link href="/register">
                <button className="bg-transparent text-white border-2 border-white/30 px-6 py-3 rounded font-bold text-sm hover:border-white hover:bg-white/5 transition-all w-full sm:w-auto">
                  Create Free Account
                </button>
              </Link>
            </div>
            <p className="text-white/40 text-xs">One-time payment · Lifetime access · No subscription</p>
          </div>

          {/* Right — contact form (30%) */}
          <div className="lg:w-[30%] shrink-0 lg:border-l lg:border-white/10 lg:pl-8">
            <div className="bg-white/5 rounded-xl p-5 border border-white/10 flex flex-col min-h-[400px]">
              <ContactHeroForm />
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy strip */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-5">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/90 text-lg font-serif italic tracking-wide">
            "Most professionals we work with had everything they needed. They just didn't know how to frame it."
          </p>
        </div>
      </div>

      {/* Features */}
      <section className="py-24 md:py-32 bg-[#0A1128]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Built for the way you work</h2>
            <p className="text-xl text-white/60 max-w-2xl">
              Every feature is designed for senior technical and research professionals navigating extraordinary ability petitions.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white/5 border border-white/10 p-8 rounded-xl hover:bg-white/[0.08] transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#1E2D6B] flex items-center justify-center mb-5">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-white mb-3 text-lg">{f.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section className="py-24 md:py-28 bg-slate-50">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-extrabold text-[#0A1128] mb-4">What you'll walk through</h2>
            <p className="text-slate-600 mb-12 text-lg">8 comprehensive modules covering the full petition lifecycle — in the order that actually makes sense.</p>
            <div className="space-y-3">
              {MODULES.map((m, i) => (
                <div key={i} className="flex items-center gap-5 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-[#1E2D6B] text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-[#0A1128] font-medium leading-snug">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0A1128] mb-6 tracking-tight">
            Stop guessing what USCIS wants.
          </h2>
          <p className="text-lg text-slate-600 mb-10 font-medium">
            One-time payment. No hidden fees. Full access to all current and future course content — forever.
          </p>
          <Link href="/excellence-lab/checkout">
            <button className="bg-[#1E2D6B] text-white px-10 py-4 rounded font-extrabold text-lg hover:bg-[#0F1F4A] transition-all hover:-translate-y-1 shadow-xl hover:shadow-[#1E2D6B]/30 inline-block">
              Get Excellence Lab — $249
            </button>
          </Link>
          <p className="text-slate-400 text-xs mt-4">Advisory coaching service. Not legal advice.</p>
        </div>
      </section>
    </PublicLayout>
  );
}
