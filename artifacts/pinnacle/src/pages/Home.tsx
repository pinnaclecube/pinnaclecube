import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function Home() {
  return (
    <PublicLayout>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-28 md:pt-52 md:pb-36 bg-[#1E2D6B] overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
          <img
            src="/bold-ascent-hero.png"
            alt="Ascending trajectory"
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="absolute -right-20 -bottom-20 text-[400px] font-black text-white/[0.03] leading-none pointer-events-none select-none">
          ³
        </div>

        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl lg:text-[84px] font-extrabold text-white leading-[1.05] tracking-tight mb-8">
              Your immigration case should be extraordinary.{" "}
              <span className="text-[#F59E0B] block mt-2">We make sure it is.</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/80 font-medium mb-12 max-w-2xl leading-relaxed">
              We strategically position senior ML Engineers, Research Scientists, and Product Directors
              as undeniable candidates for EB-1A, EB-2 NIW, and O-1A visas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/dashboard">
                <button className="bg-white text-[#1E2D6B] px-8 py-4 rounded font-extrabold text-lg hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-black/10 w-full sm:w-auto">
                  Start Your Assessment
                </button>
              </Link>
              <Link href="/how-it-works">
                <button className="bg-transparent text-white border-2 border-white/30 px-8 py-4 rounded font-bold text-lg hover:border-white hover:bg-white/5 transition-all w-full sm:w-auto">
                  Explore the Process
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Philosophy Strip ───────────────────────────────────────────────── */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-5">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/90 text-lg md:text-xl font-serif italic tracking-wide">
            "Not a law firm. A strategic ally."
          </p>
        </div>
      </div>

      {/* ── Products ───────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 bg-[#0A1128]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Built for Excellence</h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Three tiers of engagement. One uncompromising standard.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Excellence Lab */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-xl relative hover:bg-white/[0.08] transition-colors group">
              <div className="absolute -top-5 -left-5 w-12 h-12 bg-[#1E2D6B] text-white rounded flex items-center justify-center font-bold text-xl border border-white/20 shadow-lg">
                01
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 mt-4">Excellence Lab</h3>
              <div className="text-3xl font-extrabold text-[#F59E0B] mb-6">$297</div>
              <p className="text-white/70 mb-8 leading-relaxed">
                Deep-dive courses on meeting USCIS criteria. Learn exactly how to generate media coverage, peer review, and awards.
              </p>
              <ul className="space-y-3 mb-8">
                {["Strategic frameworks", "Templates & examples", "Criteria breakdown", "Self-paced learning"].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-white/80 text-sm">
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
              <h3 className="text-2xl font-bold text-[#0A1128] mb-2 mt-4">Evidence Vault</h3>
              <div className="text-3xl font-extrabold text-[#1E2D6B] mb-6">$497</div>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Secure workspace for organizing petition evidence, mapped to criteria with expert feedback on your profile.
              </p>
              <ul className="space-y-3 mb-8">
                {["Secure document storage", "Criteria mapping tool", "Expert profile review", "Readiness scoring"].map((f) => (
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
              <div className="text-sm font-bold text-white/50 mb-6 uppercase tracking-widest mt-1">
                Application Only
              </div>
              <p className="text-white/70 mb-8 leading-relaxed">
                High-touch 1:1 strategy and petition drafting. For exceptional candidates who want a fully managed process.
              </p>
              <ul className="space-y-3 mb-8">
                {["1:1 Strategy sessions", "Full petition drafting", "Recommendation letters", "Premium support"].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-white/80 text-sm">
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

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 bg-slate-50 overflow-hidden relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-slate-100 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#0A1128] mb-6">The Methodology</h2>
            <p className="text-xl text-slate-600 max-w-2xl">
              A systematic approach to building an undeniable immigration petition. No guesswork. Just strategy.
            </p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute left-12 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-16 md:space-y-24 relative">
              {[
                {
                  n: "1",
                  title: "Assess & Strategize",
                  offset: "md:ml-0",
                  text: "We evaluate your background against USCIS criteria with brutal honesty. We identify gaps, select your strongest angle, and build a roadmap to elevate your profile before you even think about filing.",
                },
                {
                  n: "2",
                  title: "Build the Evidence",
                  offset: "md:ml-24",
                  text: "Using our Excellence Lab and Evidence Vault, you execute the strategy. You publish, present, review, and gather. We provide the frameworks, templates, and feedback to ensure every piece of evidence is bulletproof.",
                },
                {
                  n: "3",
                  title: "Draft & File",
                  offset: "md:ml-48",
                  text: "When the profile is undeniable, we construct the narrative. We draft the petition and recommendation letters (Elite tier) or guide you through the process, ensuring the final submission is a masterpiece of technical advocacy.",
                },
              ].map((step) => (
                <div key={step.n} className={`flex flex-col md:flex-row gap-8 md:gap-16 items-start ${step.offset}`}>
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

      {/* ── Social Proof ───────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 bg-[#1E2D6B] relative overflow-hidden">
        <div className="absolute -left-20 top-0 text-[300px] font-black text-white/[0.03] leading-none pointer-events-none select-none">
          ³
        </div>
        <div className="max-w-[1100px] mx-auto px-6 relative z-10 text-center">
          <div className="text-5xl text-[#F59E0B] mb-8 leading-none">❝</div>
          <blockquote className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-4xl mx-auto mb-12">
            Pinnacle³ didn't just help me file a petition; they helped me understand my own value.
            The strategic rigor was on par with engineering standards at top-tier tech companies.{" "}
            <span className="text-[#F59E0B]">Approved in 11 days.</span>
          </blockquote>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-white/10 rounded-full mb-4 flex items-center justify-center text-white font-bold text-xl border border-white/20">
              AR
            </div>
            <div className="text-[#F59E0B] font-bold text-xl tracking-wide">Staff Machine Learning Engineer</div>
            <div className="text-white/50 font-medium mt-1">FAANG Company · EB-1A Approved</div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-32 bg-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-5xl md:text-6xl font-extrabold text-[#0A1128] mb-8 tracking-tight">
            Ready to ascend?
          </h2>
          <p className="text-xl text-slate-600 mb-12 font-medium">
            Stop guessing what USCIS wants. Start building an undeniable case with strategic precision.
          </p>
          <Link href="/dashboard">
            <button className="bg-[#1E2D6B] text-white px-10 py-5 rounded font-extrabold text-xl hover:bg-[#0F1F4A] transition-all hover:-translate-y-1 shadow-2xl hover:shadow-[#1E2D6B]/30 inline-block">
              Start Your Assessment Now
            </button>
          </Link>
        </div>
      </section>

    </PublicLayout>
  );
}
