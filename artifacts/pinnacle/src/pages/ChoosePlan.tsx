import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/contexts/AuthContext";
import { useProductAccess } from "@/hooks/useProductAccess";
import { BookOpen, Shield, Star, ArrowRight, CheckCircle2 } from "lucide-react";

const products = [
  {
    key: "excellence_lab",
    icon: BookOpen,
    name: "Excellence Lab",
    badge: "Most Popular",
    price: "$249",
    period: "one-time",
    tagline: "Learn how to frame your career the way USCIS expects.",
    bullets: [
      "Self-paced course library",
      "Criteria-by-criteria breakdown",
      "Lifetime access — no subscription",
      "Includes Readiness Intake",
    ],
    cta: "Get Access — $249",
    href: "/excellence-lab/checkout",
    accent: false,
  },
  {
    key: "evidence_engine",
    icon: Shield,
    name: "Evidence Engine",
    badge: "Includes Excellence Lab",
    price: "$49",
    period: "/mo",
    tagline: "Organize every achievement into a petition-ready case file.",
    bullets: [
      "Private Google Drive workspace",
      "AI-guided evidence analysis",
      "Gap identification and alerts",
      "Cancel anytime",
    ],
    cta: "Get Access — $49/mo",
    href: "/evidence-vault/checkout",
    accent: true,
  },
  {
    key: "elite_blueprint",
    icon: Star,
    name: "Elite Blueprint",
    badge: "Premium Advisory",
    price: "Custom",
    period: "",
    tagline: "A dedicated advisor who knows your case from day one to filing.",
    bullets: [
      "1-on-1 dedicated advisor",
      "Bespoke petition strategy",
      "Full-service case support",
      "Application-only · Limited capacity",
    ],
    cta: "Apply for Elite Blueprint",
    href: "/elite-blueprint/apply",
    accent: false,
  },
];

export default function ChoosePlan() {
  const { user } = useAuth();
  const { hasExcellenceLab, isLoading } = useProductAccess();
  const [, navigate] = useLocation();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    if (!isLoading && hasExcellenceLab) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, hasExcellenceLab, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Logo href="/" />
        <Link href="/profile">
          <span className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer transition-colors">
            {user?.name}
          </span>
        </Link>
      </header>

      {/* Hero */}
      <div className="bg-[#1E2D6B] text-white py-14 px-6 text-center relative overflow-hidden">
        <div className="absolute right-12 -bottom-8 text-[260px] font-black text-white/[0.04] leading-none pointer-events-none select-none">³</div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            Account created successfully
          </div>
          <h1 className="text-3xl font-extrabold mb-3 tracking-tight">
            Welcome, {firstName}. Choose your starting point.
          </h1>
          <p className="text-white/60 text-base leading-relaxed">
            All products unlock your Readiness Intake — a personalized assessment of your visa eligibility profile.
          </p>
        </div>
      </div>

      {/* Product cards */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.key}
                className={`relative rounded-2xl flex flex-col overflow-hidden border transition-shadow hover:shadow-xl ${
                  p.accent
                    ? "bg-[#1E2D6B] border-[#1E2D6B] text-white shadow-lg shadow-[#1E2D6B]/20"
                    : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                {/* Badge */}
                <div className={`px-6 pt-6 pb-0`}>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${
                      p.accent
                        ? "bg-white/15 text-white/80"
                        : p.key === "elite_blueprint"
                        ? "bg-[#F59E0B]/15 text-[#B45309]"
                        : "bg-[#1E2D6B]/10 text-[#1E2D6B]"
                    }`}
                  >
                    {p.key === "elite_blueprint" && <Star className="w-3 h-3 fill-current" />}
                    {p.badge}
                  </span>

                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        p.accent ? "bg-white/15" : "bg-[#1E2D6B]/10"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${p.accent ? "text-white" : "text-[#1E2D6B]"}`} />
                    </div>
                    <h2 className={`text-lg font-extrabold ${p.accent ? "text-white" : "text-slate-900"}`}>
                      {p.name}
                    </h2>
                  </div>

                  <div className="flex items-baseline gap-1 mb-2">
                    <span className={`text-4xl font-extrabold ${p.accent ? "text-white" : "text-slate-900"}`}>
                      {p.price}
                    </span>
                    {p.period && (
                      <span className={`text-sm font-medium ${p.accent ? "text-white/60" : "text-slate-400"}`}>
                        {p.period}
                      </span>
                    )}
                  </div>

                  <p className={`text-sm leading-relaxed mb-5 ${p.accent ? "text-white/70" : "text-slate-500"}`}>
                    {p.tagline}
                  </p>
                </div>

                {/* Divider */}
                <div className={`mx-6 border-t mb-5 ${p.accent ? "border-white/15" : "border-slate-100"}`} />

                {/* Bullets */}
                <ul className="px-6 space-y-2.5 flex-1">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 shrink-0 ${p.accent ? "text-[#F59E0B]" : "text-[#1E2D6B]"}`}
                      />
                      <span className={p.accent ? "text-white/80" : "text-slate-600"}>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="p-6 pt-5">
                  <Link href={p.href}>
                    <button
                      className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        p.accent
                          ? "bg-[#F59E0B] hover:bg-[#D97706] text-white shadow-md"
                          : p.key === "elite_blueprint"
                          ? "bg-slate-900 hover:bg-slate-700 text-white"
                          : "bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white"
                      }`}
                    >
                      {p.cta}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-slate-400 text-xs mt-10">
          Pinnacle³ is an advisory coaching service — not a law firm. Content does not constitute legal advice.{" "}
          <Link href="/disclaimer" className="underline hover:text-slate-600">
            Read our disclaimer.
          </Link>
        </p>
      </main>
    </div>
  );
}
