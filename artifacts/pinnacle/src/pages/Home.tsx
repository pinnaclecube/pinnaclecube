import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { TestimonialsCarousel } from "@/components/ui/TestimonialsCarousel";
import { ContactHeroForm } from "@/components/ContactHeroForm";
import { useState, useEffect, useCallback } from "react";

const SLIDES = [
  {
    headline: "You've worked for this.",
    accent: "Your visa should prove it.",
    sub: "You've spent years publishing research, leading teams, and building products that matter. The challenge isn't your record — it's knowing how to present it. We translate your career into evidence USCIS cannot dismiss.",
    cta: "See How We Do It",
    ctaHref: "/how-it-works",
    secondary: "Start Free Assessment",
    secondaryHref: "/dashboard",
  },
  {
    headline: "You've been told you might not qualify.",
    accent: "We hear that a lot.",
    sub: "Most of the professionals we work with arrived uncertain — 'Maybe I'm not enough.' The truth is, you likely are. USCIS doesn't speak the language of engineers and researchers. We do. And we translate it for them.",
    cta: "Take the Readiness Quiz",
    ctaHref: "/quiz",
    secondary: "Explore the Platform",
    secondaryHref: "/products",
  },
  {
    headline: "You're too busy to figure this out alone.",
    accent: "That's why we exist.",
    sub: "You're leading ML teams, publishing papers, advising startups across time zones. You don't have bandwidth to decode USCIS policy. We've done it thousands of times. You focus on your work. We build the case.",
    cta: "See the Process",
    ctaHref: "/how-it-works",
    secondary: "Start Your Assessment",
    secondaryHref: "/dashboard",
  },
  {
    headline: "Your attorney files the petition.",
    accent: "We build what they file.",
    sub: "Immigration attorneys are excellent at the law. But they need you to bring the evidence, the narrative, and the strategic framing. That's our entire job. We make your attorney's work — and your application — undeniable.",
    cta: "See Our Products",
    ctaHref: "/products",
    secondary: "Get Started Now",
    secondaryHref: "/dashboard",
  },
];

function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback(
    (idx: number) => {
      if (animating || idx === active) return;
      setAnimating(true);
      setTimeout(() => {
        setActive(idx);
        setAnimating(false);
      }, 300);
    },
    [active, animating]
  );

  useEffect(() => {
    const id = setInterval(() => {
      goTo((active + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(id);
  }, [active, goTo]);

  const slide = SLIDES[active];

  return (
    <section className="relative h-svh bg-[#1E2D6B] overflow-hidden flex flex-col">
      {/* Background image */}
      <div className="absolute inset-0 opacity-[0.18] pointer-events-none mix-blend-overlay">
        <img
          src="/bold-ascent-hero.png"
          alt=""
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Decorative ³ */}
      <div className="absolute right-[32%] -bottom-16 text-[400px] font-black text-white/[0.025] leading-none pointer-events-none select-none hidden lg:block">
        ³
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-10">
        <div
          key={active}
          className="h-full bg-[#F59E0B] transition-none"
          style={{ animation: "progress-fill 6s linear forwards" }}
        />
      </div>

      {/* Main content — 70 / 30 split */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1280px] mx-auto w-full px-6 pt-24 pb-6 gap-6 relative z-10 min-h-0">

        {/* ── Left: carousel (70%) ──────────────────────────────────────── */}
        <div className="flex flex-col justify-center lg:w-[70%] lg:pr-10 py-4 min-h-0">
          <div
            className="transition-all duration-300"
            style={{ opacity: animating ? 0 : 1, transform: animating ? "translateY(8px)" : "translateY(0)" }}
          >
            {/* Slide indicator */}
            <div className="text-white/40 text-[11px] font-bold uppercase tracking-[0.2em] mb-6">
              {String(active + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
            </div>

            <h1 className="text-[clamp(2rem,4.5vw,52px)] font-extrabold text-white leading-[1.05] tracking-tight mb-3">
              {slide.headline}
            </h1>
            <h2 className="text-[clamp(2rem,4.5vw,52px)] font-extrabold text-[#F59E0B] leading-[1.05] tracking-tight mb-6">
              {slide.accent}
            </h2>

            <p className="text-[clamp(0.9rem,1.4vw,17px)] text-white/70 font-medium mb-8 max-w-xl leading-relaxed">
              {slide.sub}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link href={slide.secondaryHref}>
                <button className="bg-white text-[#1E2D6B] px-6 py-3 rounded font-extrabold text-sm hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-black/10 w-full sm:w-auto">
                  {slide.secondary}
                </button>
              </Link>
              <Link href={slide.ctaHref}>
                <button className="bg-transparent text-white border-2 border-white/30 px-6 py-3 rounded font-bold text-sm hover:border-white hover:bg-white/5 transition-all w-full sm:w-auto">
                  {slide.cta}
                </button>
              </Link>
            </div>

            {/* Dot navigation */}
            <div className="flex items-center gap-3">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={[
                    "rounded-full transition-all duration-300",
                    i === active
                      ? "w-8 h-2 bg-[#F59E0B]"
                      : "w-2 h-2 bg-white/30 hover:bg-white/60",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: contact form (30%) ─────────────────────────────────── */}
        <div className="lg:w-[30%] flex flex-col justify-center min-h-0">
          <div className="bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-2xl p-5 flex flex-col gap-0 h-full max-h-[580px] overflow-y-auto">
            <ContactHeroForm />
          </div>
        </div>

      </div>

      <style>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </section>
  );
}

export default function Home() {
  return (
    <PublicLayout>

      {/* ── Hero Carousel ──────────────────────────────────────────────────── */}
      <HeroCarousel />

      {/* ── Philosophy Strip ───────────────────────────────────────────────── */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-5">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/90 text-lg md:text-xl font-serif italic tracking-wide">
            "Not a law firm. A strategic ally — built for people who have already proven they're extraordinary."
          </p>
        </div>
      </div>

      {/* ── Trust Stats ────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { stat: "94%", label: "Approval rate for clients who complete our program" },
              { stat: "11 days", label: "Fastest EB-1A approval achieved by a Pinnacle³ client" },
              { stat: "3 visas", label: "Covered: EB-1A, EB-2 NIW, O-1A" },
              { stat: "0", label: "Attorney relationships required to get started" },
            ].map(({ stat, label }) => (
              <div key={stat} className="space-y-2">
                <div className="text-4xl font-extrabold text-[#1E2D6B]">{stat}</div>
                <div className="text-sm text-slate-500 leading-snug">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ───────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 bg-[#0A1128]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Built for Where You Are</h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Whether you're just beginning to explore or ready to build your case — there's a path for you.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Excellence Lab */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-xl relative hover:bg-white/[0.08] transition-colors group">
              <div className="absolute -top-5 -left-5 w-12 h-12 bg-[#1E2D6B] text-white rounded flex items-center justify-center font-bold text-xl border border-white/20 shadow-lg">
                01
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 mt-4">Excellence Lab</h3>
              <div className="text-3xl font-extrabold text-[#F59E0B] mb-4">$249</div>
              <p className="text-white/65 mb-8 leading-relaxed text-sm">
                You know you've accomplished something significant. The Lab teaches you how to frame it — media coverage, peer review, advisory roles — in the exact language USCIS needs to see.
              </p>
              <ul className="space-y-3 mb-8">
                {["Criterion-by-criterion playbooks", "Real examples from approved petitions", "Templates you can start using today", "Self-paced, lifetime access"].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-white/75 text-sm">
                    <span className="text-[#818CF8] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/excellence-lab">
                <button className="w-full py-3 rounded border border-white/20 text-white font-bold group-hover:bg-white group-hover:text-[#0A1128] transition-colors text-sm">
                  Join the Lab
                </button>
              </Link>
            </div>

            {/* Evidence Vault — highlighted */}
            <div className="bg-white border-2 border-[#1E2D6B] p-8 rounded-xl relative md:-translate-y-4 shadow-2xl">
              <div className="absolute -top-5 -left-5 w-12 h-12 bg-[#1E2D6B] text-white rounded flex items-center justify-center font-bold text-xl shadow-lg">
                02
              </div>
              <div className="absolute top-4 right-4 bg-[#F59E0B]/20 text-[#D97706] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-[#0A1128] mb-2 mt-4">Evidence Engine</h3>
              <div className="text-3xl font-extrabold text-[#1E2D6B] mb-1">$49<span className="text-lg font-bold">/mo</span></div>
              <div className="text-xs text-slate-400 mb-3">Cancel anytime</div>
              <p className="text-slate-600 mb-8 leading-relaxed text-sm">
                Stop drowning in shared folders and disorganized files. The Vault maps every document you own directly to an EB-1A or NIW criterion — so you (and your future attorney) can see exactly where you stand.
              </p>
              <ul className="space-y-3 mb-8">
                {["Secure document storage by criterion", "AI-powered gap analysis", "Readiness score per criterion", "Attorney-ready formatting"].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-slate-700 text-sm font-medium">
                    <span className="text-[#1E2D6B] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/evidence-vault">
                <button className="w-full py-3 rounded bg-[#1E2D6B] text-white font-bold hover:bg-[#0F1F4A] transition-colors text-sm">
                  Access Vault
                </button>
              </Link>
            </div>

            {/* Elite Blueprint */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-xl relative hover:bg-white/[0.08] transition-colors group">
              <div className="absolute -top-5 -left-5 w-12 h-12 bg-[#1E2D6B] text-white rounded flex items-center justify-center font-bold text-xl border border-white/20 shadow-lg">
                03
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 mt-4">Elite Blueprint</h3>
              <div className="text-sm font-bold text-white/40 mb-4 uppercase tracking-widest">
                Application Only
              </div>
              <p className="text-white/65 mb-8 leading-relaxed text-sm">
                For professionals who want someone in their corner who knows exactly what they're doing. A dedicated advisor who reviews your profile, builds your strategy, and stands beside you through every milestone.
              </p>
              <ul className="space-y-3 mb-8">
                {["1:1 strategy sessions with an advisor", "Custom 30/60/90-day filing plan", "Petition & recommendation letter drafting", "Async advisor access throughout"].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-white/75 text-sm">
                    <span className="text-[#818CF8] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/elite-blueprint">
                <button className="w-full py-3 rounded border border-white/20 text-white font-bold group-hover:bg-white group-hover:text-[#0A1128] transition-colors text-sm">
                  Apply for Elite
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Methodology ────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 bg-slate-50 overflow-hidden relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-slate-100 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#0A1128] mb-6">How We Work</h2>
            <p className="text-xl text-slate-600 max-w-2xl">
              No vague timelines. No generic checklists. A systematic methodology tailored to how you've actually built your career.
            </p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-12 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-16 md:space-y-20 relative">
              {[
                {
                  n: "1",
                  title: "Understand Where You Stand",
                  text: "We start with an honest, detailed assessment of your profile against EB-1A, NIW, and O-1A criteria. No sugarcoating — just clarity on what's strong, what's weak, and what's possible.",
                },
                {
                  n: "2",
                  title: "Build the Evidence Strategically",
                  text: "Using the Excellence Lab and Evidence Engine, you gather and organize evidence with surgical precision. Every document is mapped to a criterion. Every gap has a plan. Nothing is uploaded without purpose.",
                },
                {
                  n: "3",
                  title: "Construct an Undeniable Case",
                  text: "When your profile is ready, we help build the narrative. We draft the petition and recommendation letters (Elite tier), or guide you through the process — so the final submission is a masterpiece of professional advocacy.",
                },
              ].map((step, i) => (
                <div
                  key={step.n}
                  className="flex flex-col md:flex-row gap-8 md:gap-16 items-start"
                  style={{ marginLeft: `${i * 48}px` }}
                >
                  <div className="w-24 h-24 bg-[#1E2D6B] text-white rounded-2xl flex items-center justify-center text-4xl font-black shadow-xl shrink-0">
                    {step.n}
                  </div>
                  <div className="pt-2 max-w-2xl">
                    <h3 className="text-3xl font-bold text-[#0A1128] mb-4">{step.title}</h3>
                    <p className="text-lg text-slate-600 leading-relaxed">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials Carousel ──────────────────────────────────────────── */}
      <TestimonialsCarousel />

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-32 bg-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-5xl md:text-6xl font-extrabold text-[#0A1128] mb-6 tracking-tight leading-tight">
            You've already done the extraordinary work.
          </h2>
          <p className="text-xl text-slate-600 mb-12 font-medium max-w-2xl mx-auto">
            Let us help you make sure USCIS sees it the same way. Start with a free readiness assessment — no commitment, no obligation.
          </p>
          <Link href="/dashboard">
            <button className="bg-[#1E2D6B] text-white px-10 py-5 rounded font-extrabold text-xl hover:bg-[#0F1F4A] transition-all hover:-translate-y-1 shadow-2xl hover:shadow-[#1E2D6B]/30 inline-block">
              Start Your Free Assessment
            </button>
          </Link>
          <p className="text-slate-400 text-sm mt-6">No credit card required · Takes 10 minutes</p>
        </div>
      </section>

    </PublicLayout>
  );
}
