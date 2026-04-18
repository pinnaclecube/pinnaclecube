import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";

const PRODUCTS = [
  {
    n: "01",
    name: "Excellence Lab",
    price: "$297",
    href: "/excellence-lab",
    cta: "Join the Lab",
    description:
      "Deep-dive technical courses on fulfilling specific USCIS criteria. Learn the exact methodologies used by successful candidates to secure media coverage, navigate peer review, and prove critical impact in your field.",
    features: [
      "Strategic Media Coverage Acquisition",
      "Peer Review Network Development",
      "Critical Capacity Role Substantiation",
      "Self-paced with expert-crafted frameworks",
    ],
    highlight: false,
  },
  {
    n: "02",
    name: "Evidence Vault",
    price: "$497",
    href: "/evidence-vault",
    cta: "Access Vault",
    description:
      "A secure, organized repository for your professional artifacts, mapped directly to visa criteria. Stop using chaotic shared folders. Organize your case with clinical precision.",
    features: [
      "Criterion-mapped evidence tracking",
      "Strength evaluation and gap analysis",
      "Expert profile review and scoring",
      "Export-ready formatting for attorney review",
    ],
    highlight: true,
  },
  {
    n: "03",
    name: "Elite Blueprint",
    price: null,
    priceLabel: "Application Only",
    href: "/elite-blueprint",
    cta: "Apply Now",
    description:
      "1-on-1 strategic coaching, precise milestone tracking, and a bespoke filing strategy crafted for your unique profile by our senior advisors.",
    features: [
      "Bespoke filing strategy and timeline",
      "Dedicated strategic advisor",
      "Full petition & recommendation letter drafting",
      "Accountability milestones and progress tracking",
    ],
    highlight: false,
  },
];

export default function Products() {
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
            <span className="text-[#F59E0B]">Ecosystem</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl leading-relaxed">
            Three purpose-built products designed to take you from uncertain to extraordinary.
            Choose the tier that matches where you are.
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

      {/* Products */}
      <section className="py-24 md:py-32 bg-[#0A1128]">
        <div className="max-w-[1100px] mx-auto px-6 space-y-8 md:space-y-12">
          {PRODUCTS.map((p) => (
            <div
              key={p.n}
              className={[
                "rounded-2xl p-8 md:p-12 relative",
                p.highlight
                  ? "bg-white shadow-2xl border-2 border-[#1E2D6B]"
                  : "bg-white/5 border border-white/10",
              ].join(" ")}
            >
              {p.highlight && (
                <div className="absolute top-6 right-6 bg-[#F59E0B]/20 text-[#D97706] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-10">
                {/* Left: info */}
                <div className="flex-1">
                  <div className="flex items-start gap-5 mb-6">
                    <div
                      className={[
                        "w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 shadow-lg",
                        p.highlight
                          ? "bg-[#1E2D6B] text-white"
                          : "bg-[#1E2D6B] text-white border border-white/20",
                      ].join(" ")}
                    >
                      {p.n}
                    </div>
                    <div>
                      <h2 className={["text-3xl font-extrabold mb-1", p.highlight ? "text-[#0A1128]" : "text-white"].join(" ")}>
                        {p.name}
                      </h2>
                      {p.price ? (
                        <div className={["text-3xl font-extrabold", p.highlight ? "text-[#1E2D6B]" : "text-[#F59E0B]"].join(" ")}>
                          {p.price}
                        </div>
                      ) : (
                        <div className={["text-sm font-bold uppercase tracking-widest", p.highlight ? "text-slate-400" : "text-white/40"].join(" ")}>
                          {p.priceLabel}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className={["text-lg leading-relaxed mb-8", p.highlight ? "text-slate-600" : "text-white/70"].join(" ")}>
                    {p.description}
                  </p>

                  <Link href={p.href}>
                    <button
                      className={[
                        "px-8 py-3.5 rounded font-bold text-sm transition-all hover:-translate-y-0.5",
                        p.highlight
                          ? "bg-[#1E2D6B] text-white hover:bg-[#0F1F4A] shadow-lg"
                          : "border border-white/20 text-white hover:bg-white hover:text-[#0A1128]",
                      ].join(" ")}
                    >
                      {p.cta}
                    </button>
                  </Link>
                </div>

                {/* Right: features */}
                <div className="md:w-72 shrink-0">
                  <h4 className={["text-xs font-bold uppercase tracking-widest mb-5", p.highlight ? "text-slate-400" : "text-white/40"].join(" ")}>
                    What's Included
                  </h4>
                  <ul className="space-y-4">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <span className={["mt-0.5 shrink-0 text-sm", p.highlight ? "text-[#1E2D6B]" : "text-[#818CF8]"].join(" ")}>✓</span>
                        <span className={["text-sm leading-relaxed", p.highlight ? "text-slate-700 font-medium" : "text-white/80"].join(" ")}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0A1128] mb-6 tracking-tight">
            Not sure where to start?
          </h2>
          <p className="text-lg text-slate-600 mb-10 font-medium">
            Take the free readiness assessment and we'll tell you exactly which product fits your profile.
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
