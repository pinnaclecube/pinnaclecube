import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/Navbar";
import { LegalFooterBar } from "@/components/disclaimers/LegalFooterBar";
import { Map, UserCheck, CalendarDays, MessageSquare, FileText, Sparkles, ChevronRight, Star } from "lucide-react";

const FEATURES = [
  {
    icon: UserCheck,
    title: "Personal Consultation",
    description: "One-on-one deep-dive session with your dedicated Pinnacle³ advisor. We review your full profile, assess your strongest criteria, and map your filing strategy.",
  },
  {
    icon: Map,
    title: "Custom Filing Blueprint",
    description: "A personalized, month-by-month action plan covering evidence gathering, story development, and petition assembly timelines.",
  },
  {
    icon: CalendarDays,
    title: "Milestone Tracking",
    description: "Your blueprint lives on the platform. Track milestones, log completions, and stay on schedule throughout your petition journey.",
  },
  {
    icon: MessageSquare,
    title: "Ongoing Advisory Access",
    description: "Async messaging with your advisor throughout the engagement. Get answers when you need them, not just in scheduled calls.",
  },
  {
    icon: FileText,
    title: "Evidence Review",
    description: "We review your key evidence items and provide written feedback on strength, gaps, and how to position each piece.",
  },
  {
    icon: Sparkles,
    title: "Full Platform Access",
    description: "Includes Excellence Lab and Evidence Vault — the complete Pinnacle³ suite.",
  },
];

const STEPS = [
  { step: "01", title: "Apply", description: "Submit a brief application describing your background, visa goal, and timeline." },
  { step: "02", title: "Review", description: "Our team reviews your application and schedules your initial consultation within 48 hours." },
  { step: "03", title: "Consultation", description: "60-minute deep-dive with your advisor to map your case strategy." },
  { step: "04", title: "Blueprint Delivery", description: "Receive your personalized 30/60/90-day filing blueprint within 5 business days." },
  { step: "05", title: "Ongoing Guidance", description: "Stay in async contact with your advisor as you execute your plan." },
];

export default function EliteBlueprintMarketing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#1E2D6B] via-[#2D3F8A] to-[#1E2D6B] text-white">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              <Star className="w-3.5 h-3.5 fill-current" />
              Elite Blueprint — Premium Advisory
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Your personal
              <span className="text-blue-300"> petition advisor</span>
            </h1>
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Pinnacle³'s most comprehensive offering. A dedicated advisor, custom filing strategy, and ongoing guidance from first assessment to petition submission.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/elite-blueprint/apply">
                <Button size="lg" className="bg-white text-[#1E2D6B] hover:bg-gray-100 text-lg px-8 h-14 font-bold">
                  Apply for Elite Blueprint
                </Button>
              </Link>
            </div>
            <p className="text-white/50 text-sm mt-4">By application only · Limited capacity · Pricing discussed during review</p>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-white">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-4">White-glove advisory support</h2>
            <p className="text-muted-foreground text-center mb-12">For professionals who want expert guidance at every stage of their petition journey.</p>
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

        {/* Process */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="container mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
            <p className="text-muted-foreground text-center mb-12">From application to ongoing advisory support in 5 steps.</p>
            <div className="space-y-4">
              {STEPS.map((s) => (
                <div key={s.step} className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-full bg-[#1E2D6B] text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {s.step}
                  </div>
                  <div className="flex-1 pb-4 border-b border-border last:border-0">
                    <h3 className="font-semibold text-foreground">{s.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Disclaimer note */}
        <section className="py-8 px-4 bg-amber-50 border-y border-amber-200">
          <div className="container mx-auto max-w-3xl">
            <p className="text-sm text-amber-800 text-center leading-relaxed">
              <strong>Important:</strong> Pinnacle³ is an advisory coaching service, not a law firm. Advisors are not attorneys and do not provide legal advice. All strategic guidance is for educational and organizational purposes only. You should engage a licensed immigration attorney to review and file any immigration petition.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-[#1E2D6B]">
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready for dedicated advisory support?</h2>
            <p className="text-white/70 mb-8 text-lg">Apply today. We review all applications within 48 hours.</p>
            <Link href="/elite-blueprint/apply">
              <Button size="lg" className="bg-white text-[#1E2D6B] hover:bg-gray-100 text-lg px-8 h-14 font-bold">
                Apply Now <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <LegalFooterBar />
    </div>
  );
}
