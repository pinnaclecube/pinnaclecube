import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Shield, Map } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="pt-24 pb-32 px-4 border-b border-border relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02]" />
        <div className="container mx-auto max-w-5xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-8 border border-blue-100">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Accepting new candidates for Q4
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Clarity for <span className="text-[#1E2D6B]">Extraordinary Talent</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            The premium advisory coaching platform for senior ML Engineers, Research Scientists, and Product Directors targeting EB-1A, EB-2 NIW, and O-1A visas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="bg-[#1E2D6B] hover:bg-[#3D4FA8] text-white px-8 h-12 text-base w-full sm:w-auto">
                Get Your Readiness Score <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base w-full sm:w-auto">
                See How It Works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-6">We are not a law firm.</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-12">
            We are strategic advisors. Immigration attorneys focus on the law. We focus on you. We help you build the evidence, craft the narrative, and align your career achievements with the strict USCIS criteria so that when you do hire an attorney, your case is undeniable.
          </p>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-24 px-4 bg-white border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">The Pinnacle³ Ecosystem</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Three purpose-built products designed to take you from uncertain to extraordinary.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-[#1E2D6B] flex items-center justify-center mb-6">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Excellence Lab</h3>
              <p className="text-muted-foreground mb-6">Deep-dive technical courses on fulfilling specific USCIS criteria, from securing media coverage to navigating peer review.</p>
              <Link href="/products" className="text-[#1E2D6B] font-medium flex items-center hover:underline">
                Explore Courses <ArrowRight className="ml-1 w-4 h-4" />
              </Link>
            </div>

            <div className="p-8 rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-[#1E2D6B] flex items-center justify-center mb-6">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Evidence Vault</h3>
              <p className="text-muted-foreground mb-6">Secure, organized repository for your professional artifacts, mapped directly to visa criteria with expert feedback.</p>
              <Link href="/products" className="text-[#1E2D6B] font-medium flex items-center hover:underline">
                View Vault <ArrowRight className="ml-1 w-4 h-4" />
              </Link>
            </div>

            <div className="p-8 rounded-xl border border-[#1E2D6B]/20 bg-blue-50/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#1E2D6B] text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                Premium
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#1E2D6B] text-white flex items-center justify-center mb-6">
                <Map className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Elite Blueprint</h3>
              <p className="text-muted-foreground mb-6">1-on-1 strategic coaching, precise milestone tracking, and a bespoke filing strategy crafted for your unique profile.</p>
              <Link href="/products" className="text-[#1E2D6B] font-medium flex items-center hover:underline">
                Discover Blueprint <ArrowRight className="ml-1 w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
