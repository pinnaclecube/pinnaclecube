import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ContactHeroForm } from "@/components/ContactHeroForm";
import { UserCheck, Map, CalendarDays, MessageSquare, FileText, Sparkles, Star } from "lucide-react";

const FEATURES = [
  {
    icon: UserCheck,
    title: "A Dedicated Advisor Who Knows Your Case",
    description: "Not a support ticket queue. A real person who reviews your full background, understands your career, and works with you directly — from first call to filing.",
  },
  {
    icon: Map,
    title: "A Custom Filing Blueprint Built Around You",
    description: "A personalized, month-by-month action plan that maps your specific evidence needs, story development milestones, and petition assembly timeline. Written for your profile, not a template.",
  },
  {
    icon: CalendarDays,
    title: "Milestone Tracking — No More Guessing",
    description: "Your Blueprint lives on the platform. You track milestones, log completions, and see clearly where you're ahead, where you're behind, and what needs attention this week.",
  },
  {
    icon: MessageSquare,
    title: "Your Advisor Is a Message Away",
    description: "Async messaging access to your dedicated advisor throughout the engagement. When something comes up — a new publication, a speaking opportunity, a strategic question — they're there.",
  },
  {
    icon: FileText,
    title: "Evidence Review With Written Feedback",
    description: "We review your key evidence items and provide detailed, written feedback on strength, positioning, and gaps — so you walk into attorney conversations knowing exactly where you stand.",
  },
  {
    icon: Sparkles,
    title: "The Complete Pinnacle³ Suite",
    description: "Includes full Excellence Lab and Evidence Engine access. Everything in one place — your courses, your documents, your advisor, and your strategy.",
  },
];

const PROCESS = [
  { step: "01", title: "Submit Your Application", description: "A brief application covering your background, visa goal, timeline, and specific challenges. We read every word." },
  { step: "02", title: "We Review and Reach Out", description: "Our team reviews your application and reaches out within 48 hours to schedule your initial consultation — or discuss fit." },
  { step: "03", title: "Your First Consultation", description: "A 60-minute session with your dedicated advisor. We go deep on your case, identify your strongest criteria, and map your filing strategy." },
  { step: "04", title: "Blueprint Delivery", description: "Within 5 business days, you receive your personalized 30/60/90-day filing blueprint — specific, actionable, and built around your actual life." },
  { step: "05", title: "Execution & Ongoing Support", description: "You execute the plan. We stay beside you — reviewing progress, answering questions, and adjusting the strategy as your profile evolves." },
];

export default function EliteBlueprintMarketing() {
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
        <div className="flex-1 flex flex-col lg:flex-row max-w-[1280px] mx-auto w-full px-6 pt-24 pb-6 gap-6 relative z-10 min-h-0">

          {/* Left — product content (70%) */}
          <div className="flex flex-col justify-center lg:w-[70%] lg:pr-10 py-4 min-h-0">
            <div className="inline-flex items-center gap-2 bg-[#F59E0B]/20 text-[#F59E0B] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8 w-fit">
              <Star className="w-3.5 h-3.5 fill-current" />
              Elite Blueprint — Premium Advisory
            </div>
            <h1 className="text-[clamp(2rem,4.5vw,52px)] font-extrabold text-white leading-[1.05] tracking-tight mb-3">
              You shouldn't have to figure this out alone.
            </h1>
            <h2 className="text-[clamp(2rem,4.5vw,52px)] font-extrabold text-[#F59E0B] leading-[1.05] tracking-tight mb-6">
              Now you don't have to.
            </h2>
            <p className="text-[clamp(0.9rem,1.4vw,17px)] text-white/70 font-medium mb-8 max-w-xl leading-relaxed">
              The Elite Blueprint is Pinnacle³'s highest-touch engagement. A dedicated advisor who knows your case deeply, a bespoke strategy built around your career, and support from assessment all the way through filing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link href="/elite-blueprint/apply">
                <button className="bg-white text-[#1E2D6B] px-6 py-3 rounded font-extrabold text-sm hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-black/10 w-full sm:w-auto">
                  Apply for Elite Blueprint
                </button>
              </Link>
              <Link href="/how-it-works">
                <button className="bg-transparent text-white border-2 border-white/30 px-6 py-3 rounded font-bold text-sm hover:border-white hover:bg-white/5 transition-all w-full sm:w-auto">
                  See How It Works
                </button>
              </Link>
            </div>
            <p className="text-white/40 text-xs">By application only · Limited capacity · Pricing discussed during review</p>
          </div>

          {/* Right — contact form (30%) */}
          <div className="lg:w-[30%] shrink-0 flex flex-col lg:border-l lg:border-white/10 lg:pl-6 min-h-0">
            <div className="bg-white/5 rounded-xl p-5 border border-white/10 h-full flex flex-col">
              <ContactHeroForm />
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy strip */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-5">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/90 text-lg font-serif italic tracking-wide">
            "For exceptional professionals who want an expert in their corner — from first conversation to approved petition."
          </p>
        </div>
      </div>

      {/* Features */}
      <section className="py-24 md:py-32 bg-[#0A1128]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">What sets Elite apart</h2>
            <p className="text-xl text-white/60 max-w-2xl">
              More than a platform. A true partnership — for professionals who are serious about getting this done right the first time.
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

      {/* Process */}
      <section className="py-24 md:py-28 bg-slate-50 relative overflow-hidden">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-100 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-extrabold text-[#0A1128] mb-4">How the process works</h2>
            <p className="text-slate-600 mb-14 text-lg">From the moment you apply to the day your petition is filed — you'll always know what's happening next.</p>
            <div className="space-y-8 relative">
              <div className="hidden md:block absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200" />
              {PROCESS.map((s) => (
                <div key={s.step} className="flex gap-8 items-start">
                  <div className="w-16 h-16 rounded-2xl bg-[#1E2D6B] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-lg">
                    {s.step}
                  </div>
                  <div className="pt-3 flex-1">
                    <h3 className="text-xl font-bold text-[#0A1128] mb-2">{s.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="bg-amber-50 border-y border-amber-200 py-6 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong>A note on our role:</strong> Pinnacle³ is an advisory coaching service, not a law firm. Our advisors are not attorneys and do not provide legal advice. All strategic guidance is educational and organizational in nature. You should engage a licensed immigration attorney to review and file any petition.
          </p>
        </div>
      </div>

      {/* CTA */}
      <section className="py-24 bg-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0A1128] mb-6 tracking-tight">
            Ready for dedicated support?
          </h2>
          <p className="text-lg text-slate-600 mb-10 font-medium">
            We review every application. Spots are limited because every client gets real attention. Apply and we'll be in touch within 48 hours.
          </p>
          <Link href="/elite-blueprint/apply">
            <button className="bg-[#1E2D6B] text-white px-10 py-4 rounded font-extrabold text-lg hover:bg-[#0F1F4A] transition-all hover:-translate-y-1 shadow-xl hover:shadow-[#1E2D6B]/30 inline-block">
              Apply Now
            </button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
