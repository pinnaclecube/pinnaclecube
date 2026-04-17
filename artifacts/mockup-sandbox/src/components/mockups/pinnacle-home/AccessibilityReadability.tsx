import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ChevronRight, FileText, LayoutTemplate, ShieldCheck, UserCheck, Play, ArrowDown, ExternalLink } from "lucide-react";

export function AccessibilityReadability() {
  return (
    <div className="font-['Plus_Jakarta_Sans'] min-h-screen bg-white text-[#1a1a1a] selection:bg-[#1E2D6B] selection:text-white pb-24">
      
      {/* Visual Skip Link Pattern for Mockup Purposes */}
      <div className="bg-[#1E2D6B] text-white p-4 text-center font-medium flex items-center justify-center gap-2 border-b-4 border-yellow-400">
        <ArrowDown className="w-5 h-5" aria-hidden="true" />
        <span className="text-[18px]">Skip to main content (Press Tab to focus)</span>
      </div>

      {/* Navigation */}
      <nav className="border-b-2 border-gray-200 py-4 px-6 md:px-12 lg:px-24 flex items-center justify-between bg-white sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tight text-[#1E2D6B]">
          <span className="bg-[#1E2D6B] text-white p-1 rounded-sm">P³</span>
          Pinnacle³
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#philosophy" className="text-[18px] font-semibold text-[#1a1a1a] hover:text-[#1E2D6B] hover:underline underline-offset-4 decoration-2">Our Philosophy</a>
          <a href="#products" className="text-[18px] font-semibold text-[#1a1a1a] hover:text-[#1E2D6B] hover:underline underline-offset-4 decoration-2">Products</a>
          <Button className="min-h-[48px] text-[16px] bg-[#1E2D6B] hover:bg-[#141f4a] text-white font-semibold px-6 gap-2">
            <UserCheck className="w-5 h-5" aria-hidden="true" />
            Client Login
          </Button>
        </div>
      </nav>

      <main id="main-content">
        {/* Hero Section */}
        <section className="px-6 md:px-12 lg:px-24 py-20 md:py-32 bg-slate-50 border-b-2 border-slate-200">
          <div className="max-w-[800px] mx-auto">
            <h1 className="text-[48px] md:text-[56px] font-extrabold text-[#1E2D6B] leading-[1.2] mb-8 tracking-tight">
              Strategic EB-1A advisory for senior tech professionals.
            </h1>
            <p className="text-[20px] md:text-[22px] text-[#1a1a1a] leading-[1.7] mb-12 max-w-[60ch] font-medium">
              We provide the strategic framework, expert feedback, and comprehensive evidence preparation platform you need to build a compelling EB-1A petition.
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
              <Button size="lg" className="min-h-[56px] text-[18px] bg-[#1E2D6B] hover:bg-[#141f4a] text-white font-bold px-8 gap-3 h-auto py-4 w-full sm:w-auto justify-center">
                <LayoutTemplate className="w-6 h-6" aria-hidden="true" />
                View Our Products
              </Button>
              <Button size="lg" variant="outline" className="min-h-[56px] text-[18px] border-2 border-[#1E2D6B] text-[#1E2D6B] hover:bg-slate-100 font-bold px-8 gap-3 h-auto py-4 w-full sm:w-auto justify-center">
                <Play className="w-6 h-6" aria-hidden="true" />
                Watch How It Works
              </Button>
            </div>
          </div>
        </section>

        {/* Philosophy Section */}
        <section id="philosophy" className="px-6 md:px-12 lg:px-24 py-24 bg-white border-b-2 border-slate-200">
          <div className="max-w-[800px] mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <ShieldCheck className="w-10 h-10 text-[#1E2D6B]" aria-hidden="true" />
              <h2 className="text-[36px] font-bold text-[#1a1a1a] leading-[1.3]">
                We are strategic advisors, not a law firm.
              </h2>
            </div>
            <p className="text-[18px] md:text-[20px] text-[#1a1a1a] leading-[1.7] mb-8 max-w-[60ch]">
              Traditional immigration attorneys handle the legal mechanics. We handle the narrative strategy, the technical translation of your work, and the rigorous evidence curation required for an extraordinary ability petition.
            </p>
            <div className="bg-amber-50 border-l-8 border-amber-500 p-6 md:p-8 rounded-r-lg">
              <h3 className="text-[22px] font-bold text-amber-900 mb-3 leading-[1.3]">Important Disclaimer</h3>
              <p className="text-[18px] text-amber-900 leading-[1.7] max-w-[60ch]">
                Pinnacle³ does not provide legal advice. We strongly recommend retaining qualified legal counsel to review and file your final petition. Our platform is designed to complement, not replace, formal legal representation.
              </p>
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section id="products" className="px-6 md:px-12 lg:px-24 py-24 bg-slate-100">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="text-[40px] font-bold text-[#1E2D6B] leading-[1.3] mb-12 text-center">
              Our Advisory Products
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Product 1 */}
              <Card className="border-2 border-slate-300 shadow-sm flex flex-col bg-white">
                <CardHeader className="border-b-2 border-slate-100 pb-6">
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8 text-blue-800" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-[28px] font-bold text-[#1a1a1a] leading-[1.3] mb-2">
                    Excellence Lab
                  </CardTitle>
                  <CardDescription className="text-[18px] text-[#4a4a4a] leading-[1.6] font-medium">
                    Self-guided strategy & narrative development.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-grow">
                  <p className="text-[18px] text-[#1a1a1a] leading-[1.7]">
                    Access our proprietary curriculum for identifying your unique narrative, mapping your achievements to EB-1A criteria, and structuring your case.
                  </p>
                </CardContent>
                <CardFooter className="pt-6 border-t-2 border-slate-100">
                  <Button className="w-full min-h-[48px] text-[16px] bg-[#1E2D6B] hover:bg-[#141f4a] font-bold gap-2 justify-center">
                    <ExternalLink className="w-5 h-5" aria-hidden="true" />
                    Explore Excellence Lab
                  </Button>
                </CardFooter>
              </Card>

              {/* Product 2 */}
              <Card className="border-2 border-indigo-300 shadow-md flex flex-col bg-indigo-50 relative">
                <div className="absolute top-0 right-0 bg-[#1E2D6B] text-white px-4 py-1 rounded-bl-lg font-bold text-[14px] tracking-wide uppercase">
                  Most Popular
                </div>
                <CardHeader className="border-b-2 border-indigo-200 pb-6">
                  <div className="bg-[#1E2D6B] w-16 h-16 rounded-full flex items-center justify-center mb-6">
                    <LayoutTemplate className="w-8 h-8 text-white" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-[28px] font-bold text-[#1E2D6B] leading-[1.3] mb-2">
                    Evidence Vault
                  </CardTitle>
                  <CardDescription className="text-[18px] text-indigo-900 leading-[1.6] font-medium">
                    Comprehensive document organization.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-grow">
                  <p className="text-[18px] text-[#1a1a1a] leading-[1.7]">
                    A structured environment to collect, tag, and refine your evidence. Includes AI-assisted document drafting and expert review of key artifacts.
                  </p>
                </CardContent>
                <CardFooter className="pt-6 border-t-2 border-indigo-200">
                  <Button className="w-full min-h-[48px] text-[16px] bg-[#1E2D6B] hover:bg-[#141f4a] font-bold gap-2 justify-center">
                    <ExternalLink className="w-5 h-5" aria-hidden="true" />
                    Explore Evidence Vault
                  </Button>
                </CardFooter>
              </Card>

              {/* Product 3 */}
              <Card className="border-2 border-slate-300 shadow-sm flex flex-col bg-white">
                <CardHeader className="border-b-2 border-slate-100 pb-6">
                  <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                    <UserCheck className="w-8 h-8 text-purple-800" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-[28px] font-bold text-[#1a1a1a] leading-[1.3] mb-2">
                    Elite Blueprint
                  </CardTitle>
                  <CardDescription className="text-[18px] text-[#4a4a4a] leading-[1.6] font-medium">
                    Full-service strategic guidance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-grow">
                  <p className="text-[18px] text-[#1a1a1a] leading-[1.7]">
                    End-to-end partnership. Includes everything in Evidence Vault, plus weekly 1:1 strategy calls and comprehensive review of your final petition draft.
                  </p>
                </CardContent>
                <CardFooter className="pt-6 border-t-2 border-slate-100">
                  <Button className="w-full min-h-[48px] text-[16px] bg-[#1E2D6B] hover:bg-[#141f4a] font-bold gap-2 justify-center">
                    <ExternalLink className="w-5 h-5" aria-hidden="true" />
                    Explore Elite Blueprint
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
