import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Shield, FolderOpen, Sparkles, BarChart, FileCheck, Lock } from "lucide-react";

const FEATURES = [
  {
    icon: FolderOpen,
    title: "Organized Around What USCIS Actually Looks For",
    description: "Your documents are organized into the exact criterion folders USCIS uses to evaluate petitions. When your attorney opens your Vault, they see a case — not a mess.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Gap Analysis",
    description: "Our AI reviews your evidence portfolio and tells you, plainly, which criteria look strong, which look thin, and what types of evidence could close the gaps before you file.",
  },
  {
    icon: BarChart,
    title: "Live Readiness Scoring",
    description: "Every criterion has a readiness score. Your overall petition strength updates in real time as you upload — so you always have a clear picture of where you stand.",
  },
  {
    icon: FileCheck,
    title: "Attorney-Ready Formatting",
    description: "Generate formatted exhibit labels, cover pages, and evidence summaries the moment you're ready. Your attorney spends less time organizing and more time advocating.",
  },
  {
    icon: Shield,
    title: "Backed by Google Drive",
    description: "Your evidence lives in a dedicated, organized Google Drive folder — secure, accessible from anywhere, and ready to share with your legal team when the time comes.",
  },
  {
    icon: Lock,
    title: "Private by Design",
    description: "Your documents are encrypted at rest. Only you and explicitly invited staff can access your files. Your career details stay yours.",
  },
];

const CRITERIA = [
  "Major Awards & Prizes",
  "Memberships in Elite Associations",
  "Published Media Coverage About You",
  "Judging Others' Work",
  "Original Contributions of Major Significance",
  "Scholarly Articles & Publications",
  "Critical Role at a Distinguished Organization",
  "High Relative Salary",
  "Commercial Success in Performing Arts",
  "Artistic Exhibitions",
];

export default function EvidenceVaultMarketing() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-24 bg-[#1E2D6B] overflow-hidden">
        <div className="absolute -right-20 -bottom-16 text-[300px] font-black text-white/[0.04] leading-none pointer-events-none select-none">³</div>
        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
            <Shield className="w-3.5 h-3.5" />
            Evidence Engine
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight max-w-3xl">
            Your years of work deserve<br />
            <span className="text-[#F59E0B]">more than a Google Drive folder.</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl leading-relaxed mb-10">
            Most professionals we talk to are sitting on years of accomplishments scattered across emails, shared drives, and bookmarks. The Evidence Engine organizes everything into a petition-ready case — and tells you exactly what's missing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/evidence-vault/checkout">
              <button className="bg-white text-[#1E2D6B] px-8 py-4 rounded font-extrabold text-lg hover:bg-gray-100 transition-all hover:scale-[1.02] shadow-xl w-full sm:w-auto">
                Get Access — $49/mo
              </button>
            </Link>
            <Link href="/register">
              <button className="bg-transparent text-white border-2 border-white/30 px-8 py-4 rounded font-bold text-lg hover:border-white hover:bg-white/5 transition-all w-full sm:w-auto">
                Start for Free
              </button>
            </Link>
          </div>
          <p className="text-white/40 text-sm mt-5">Includes Excellence Lab · One-time payment · Lifetime access</p>
        </div>
      </section>

      {/* Philosophy strip */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-5">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/90 text-lg font-serif italic tracking-wide">
            "The evidence was always there. It just needed a home — and a strategy."
          </p>
        </div>
      </div>

      {/* Features */}
      <section className="py-24 md:py-32 bg-[#0A1128]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Every feature built around how USCIS thinks</h2>
            <p className="text-xl text-white/60 max-w-2xl">
              This isn't a generic document tool. Everything in the Vault is designed around one question: what does an adjudicator need to see in order to approve this petition?
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

      {/* Criteria coverage */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-extrabold text-[#0A1128] mb-4">All 10 EB-1A criteria. Every NIW prong.</h2>
            <p className="text-slate-600 mb-12 text-lg">
              Each criterion has its own organized folder, readiness score, and personalized guidance. Nothing slips through the cracks.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CRITERIA.map((c, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-[#1E2D6B] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <span className="text-[#0A1128] font-medium text-sm leading-snug">{c}</span>
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
            Build your petition-ready case.
          </h2>
          <p className="text-lg text-slate-600 mb-10 font-medium">
            Includes full Excellence Lab access. $49/month — cancel anytime. Everything you need to walk into an attorney's office prepared.
          </p>
          <Link href="/evidence-vault/checkout">
            <button className="bg-[#1E2D6B] text-white px-10 py-4 rounded font-extrabold text-lg hover:bg-[#0F1F4A] transition-all hover:-translate-y-1 shadow-xl hover:shadow-[#1E2D6B]/30 inline-block">
              Get Evidence Engine — $49/mo
            </button>
          </Link>
          <p className="text-slate-400 text-xs mt-4">AI outputs require attorney review. Advisory coaching service.</p>
        </div>
      </section>
    </PublicLayout>
  );
}
