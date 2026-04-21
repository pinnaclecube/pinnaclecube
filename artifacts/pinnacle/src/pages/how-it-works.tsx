import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";

const STEPS = [
  {
    title: "Initial Readiness Assessment",
    description:
      "We evaluate your background, citations, publications, and professional impact against strict USCIS criteria to determine your viability for EB-1A, EB-2 NIW, or O-1A.",
  },
  {
    title: "Evidence Engine Construction",
    description:
      "You begin uploading your artifacts into our secure Evidence Engine. Our system categorizes them by criterion, identifying gaps and strengths in your profile.",
  },
  {
    title: "Elite Blueprint Strategy",
    description:
      "We develop a bespoke, milestone-driven Elite Blueprint. This strategic roadmap details exactly what additional evidence you need to acquire and by when.",
  },
  {
    title: "Excellence Lab Execution",
    description:
      "For areas needing reinforcement, you engage with our Excellence Lab courses—learning exactly how to secure targeted media coverage, high-impact peer review opportunities, or critical advisory roles.",
  },
  {
    title: "Final Review & Attorney Handoff",
    description:
      "Once your profile reaches our 'Ready to File' threshold, your Evidence Engine is finalized. You are now prepared to engage an immigration attorney with a fully substantiated, undeniable case.",
  },
];

export default function HowItWorks() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-24 bg-[#1E2D6B] overflow-hidden">
        <div className="absolute -right-20 -bottom-16 text-[300px] font-black text-white/[0.04] leading-none pointer-events-none select-none">
          ³
        </div>
        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
            The Pinnacle³<br />
            <span className="text-[#F59E0B]">Methodology</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl leading-relaxed">
            A deterministic, five-phase process for building an undeniable immigration petition. No guesswork. No vague timelines.
          </p>
        </div>
      </section>

      {/* Philosophy strip */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-5">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/90 text-lg font-serif italic tracking-wide">
            "Not a law firm. A strategic ally."
          </p>
        </div>
      </div>

      {/* Steps */}
      <section className="py-24 md:py-32 bg-slate-50 overflow-hidden relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-slate-100 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="relative">
            <div className="hidden md:block absolute left-12 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-20 relative">
              {STEPS.map((step, i) => (
                <div
                  key={i}
                  className="flex flex-col md:flex-row gap-8 md:gap-16 items-start"
                  style={{ marginLeft: `${Math.min(i, 3) * 48}px` }}
                >
                  <div className="w-24 h-24 bg-[#1E2D6B] text-white rounded-2xl flex items-center justify-center text-4xl font-black shadow-xl shrink-0">
                    {i + 1}
                  </div>
                  <div className="pt-3 max-w-2xl">
                    <h3 className="text-3xl font-bold text-[#0A1128] mb-4">{step.title}</h3>
                    <p className="text-lg text-slate-600 leading-relaxed">{step.description}</p>
                  </div>
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
            Ready to start?
          </h2>
          <p className="text-lg text-slate-600 mb-10 font-medium">
            Take your free readiness assessment and see exactly where you stand.
          </p>
          <Link href="/dashboard">
            <button className="bg-[#1E2D6B] text-white px-10 py-4 rounded font-extrabold text-lg hover:bg-[#0F1F4A] transition-all hover:-translate-y-1 shadow-xl hover:shadow-[#1E2D6B]/30 inline-block">
              Get Your Readiness Score
            </button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
