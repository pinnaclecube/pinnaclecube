import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EditorialPrestige() {
  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1A2340] font-sans selection:bg-[#C9A84C] selection:text-white overflow-y-auto">
      {/* Navbar */}
      <nav className="border-b border-[#1A2340]/10 px-6 py-4 sticky top-0 bg-[#FAF8F3]/90 backdrop-blur-sm z-50">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div className="font-['Playfair_Display'] font-bold text-2xl tracking-tight">
            Pinnacle³
          </div>
          <div className="hidden md:flex space-x-8 text-sm font-medium tracking-wide">
            <a href="#philosophy" className="hover:text-[#C9A84C] transition-colors">Philosophy</a>
            <a href="#products" className="hover:text-[#C9A84C] transition-colors">Offerings</a>
            <a href="#process" className="hover:text-[#C9A84C] transition-colors">Process</a>
            <a href="#proof" className="hover:text-[#C9A84C] transition-colors">Results</a>
          </div>
          <div className="flex items-center space-x-4">
            <a href="#" className="text-sm font-medium hover:text-[#C9A84C] transition-colors hidden md:block">Log In</a>
            <Button className="bg-[#1A2340] text-white hover:bg-[#1A2340]/90 rounded-none px-6 uppercase text-xs tracking-widest font-semibold h-10">
              Apply Now
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-6 border-b border-[#1A2340]/10">
        <div className="absolute inset-0 z-0">
          <img 
            src="/__mockup/images/editorial-hero-bg.png" 
            alt="Abstract background" 
            className="w-full h-full object-cover opacity-10 grayscale mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#FAF8F3]" />
        </div>
        
        <div className="max-w-[1100px] mx-auto relative z-10">
          <div className="w-16 h-[1px] bg-[#C9A84C] mb-8"></div>
          <h1 className="font-['Playfair_Display'] text-5xl md:text-7xl font-medium leading-[1.1] tracking-tight max-w-4xl text-[#1A2340]">
            The strategic advantage for extraordinary talent.
          </h1>
          <p className="mt-8 text-lg md:text-xl text-[#1A2340]/80 max-w-2xl leading-relaxed font-light">
            We build undeniable O-1A and EB-1A petitions for elite Machine Learning Engineers, Research Scientists, and Product Directors. Calm, competent, and deeply strategic.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center gap-6">
            <Button className="w-full sm:w-auto bg-[#1A2340] text-white hover:bg-[#1A2340]/90 rounded-none px-8 py-6 uppercase text-sm tracking-widest font-semibold">
              Apply for Elite Blueprint
            </Button>
            <a href="#products" className="group flex items-center text-sm font-bold uppercase tracking-widest text-[#1A2340] hover:text-[#C9A84C] transition-colors">
              Explore Offerings
              <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* Trust/Philosophy Bar */}
      <section id="philosophy" className="border-b border-[#1A2340]/10 bg-[#1A2340] text-[#FAF8F3] py-16 px-6">
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <h2 className="font-['Playfair_Display'] text-3xl md:text-4xl w-full md:w-1/3 leading-tight text-[#C9A84C]">
            We are not a law firm.
          </h2>
          <div className="w-full md:w-2/3 md:pl-16 md:border-l border-[#FAF8F3]/20">
            <p className="text-lg leading-relaxed font-light opacity-90">
              Lawyers format paperwork; we architect your narrative. As strategic advisors, we translate your deep technical contributions into criteria that immigration officers understand and approve. We are your fractional petition team.
            </p>
          </div>
        </div>
      </section>

      {/* Products Showcase */}
      <section id="products" className="py-24 px-6 border-b border-[#1A2340]/10">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <div className="text-sm font-bold uppercase tracking-widest text-[#C9A84C] mb-4">Our Offerings</div>
              <h2 className="font-['Playfair_Display'] text-4xl md:text-5xl">Engineered for excellence.</h2>
            </div>
            <p className="max-w-md text-[#1A2340]/70 font-light text-sm">
              From self-guided strategy to fully bespoke petition development, select the level of support that matches your timeline and ambition.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="rounded-none border border-[#1A2340]/10 bg-transparent shadow-none hover:border-[#C9A84C] transition-colors flex flex-col">
              <CardContent className="p-10 flex flex-col h-full">
                <div className="font-['Playfair_Display'] text-3xl text-[#1A2340]/30 mb-8">I.</div>
                <h3 className="font-['Playfair_Display'] text-2xl font-bold mb-2">Excellence Lab</h3>
                <div className="text-sm font-medium tracking-wide text-[#C9A84C] mb-6">$297</div>
                <p className="text-[#1A2340]/80 font-light mb-8 flex-grow">
                  Deep-dive tactical courses on meeting specific USCIS criteria. Learn exactly how to secure press coverage, peer review invitations, and industry awards.
                </p>
                <div className="mt-auto border-t border-[#1A2340]/10 pt-6">
                  <a href="#" className="text-xs font-bold uppercase tracking-widest hover:text-[#C9A84C] transition-colors flex items-center justify-between">
                    <span>Access Lab</span>
                    <span>→</span>
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border border-[#1A2340]/10 bg-transparent shadow-none hover:border-[#C9A84C] transition-colors flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#1A2340] text-white text-[10px] uppercase tracking-widest py-1 px-3">Most Popular</div>
              <CardContent className="p-10 flex flex-col h-full">
                <div className="font-['Playfair_Display'] text-3xl text-[#1A2340]/30 mb-8">II.</div>
                <h3 className="font-['Playfair_Display'] text-2xl font-bold mb-2">Evidence Vault</h3>
                <div className="text-sm font-medium tracking-wide text-[#C9A84C] mb-6">$497</div>
                <p className="text-[#1A2340]/80 font-light mb-8 flex-grow">
                  The definitive workspace for organizing your petition. Map your career achievements to specific criteria and receive async expert feedback on your evidence strength.
                </p>
                <div className="mt-auto border-t border-[#1A2340]/10 pt-6">
                  <a href="#" className="text-xs font-bold uppercase tracking-widest hover:text-[#C9A84C] transition-colors flex items-center justify-between">
                    <span>Unlock Vault</span>
                    <span>→</span>
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border border-[#1A2340] bg-[#1A2340] text-[#FAF8F3] shadow-none flex flex-col">
              <CardContent className="p-10 flex flex-col h-full">
                <div className="font-['Playfair_Display'] text-3xl text-[#C9A84C]/50 mb-8">III.</div>
                <h3 className="font-['Playfair_Display'] text-2xl font-bold mb-2">Elite Blueprint</h3>
                <div className="text-sm font-medium tracking-wide text-[#C9A84C] mb-6">Application Only</div>
                <p className="text-[#FAF8F3]/80 font-light mb-8 flex-grow">
                  High-touch 1:1 strategy and bespoke petition drafting. We handle the narrative, the evidence structuring, and the recommendation letters.
                </p>
                <div className="mt-auto border-t border-[#FAF8F3]/20 pt-6">
                  <a href="#" className="text-xs font-bold uppercase tracking-widest text-[#C9A84C] hover:text-white transition-colors flex items-center justify-between">
                    <span>Apply Now</span>
                    <span>→</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="process" className="py-24 px-6 border-b border-[#1A2340]/10 bg-white">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-['Playfair_Display'] text-4xl md:text-5xl mb-6">The Methodology</h2>
            <div className="w-16 h-[1px] bg-[#C9A84C] mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-0 right-0 h-[1px] bg-[#1A2340]/10 z-0"></div>
            
            <div className="relative z-10 bg-white pt-8">
              <div className="w-8 h-8 rounded-full border-2 border-[#1A2340] bg-white flex items-center justify-center text-xs font-bold mb-6 mx-auto">1</div>
              <h3 className="font-['Playfair_Display'] text-xl font-bold text-center mb-4">Assess</h3>
              <p className="text-center text-[#1A2340]/70 font-light text-sm leading-relaxed px-4">
                We evaluate your profile against current USCIS adjudication trends, identifying structural weaknesses and strategic opportunities.
              </p>
            </div>
            
            <div className="relative z-10 bg-white pt-8">
              <div className="w-8 h-8 rounded-full border-2 border-[#1A2340] bg-white flex items-center justify-center text-xs font-bold mb-6 mx-auto">2</div>
              <h3 className="font-['Playfair_Display'] text-xl font-bold text-center mb-4">Build</h3>
              <p className="text-center text-[#1A2340]/70 font-light text-sm leading-relaxed px-4">
                Through our structured framework, we transform raw technical achievements into compelling, criteria-aligned evidence.
              </p>
            </div>
            
            <div className="relative z-10 bg-white pt-8">
              <div className="w-8 h-8 rounded-full border-2 border-[#1A2340] bg-[#1A2340] text-white flex items-center justify-center text-xs font-bold mb-6 mx-auto">3</div>
              <h3 className="font-['Playfair_Display'] text-xl font-bold text-center mb-4">File</h3>
              <p className="text-center text-[#1A2340]/70 font-light text-sm leading-relaxed px-4">
                Your petition is finalized with irrefutable documentation, ready for submission by your attorney or directly to USCIS.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section id="proof" className="py-24 px-6 border-b border-[#1A2340]/10">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-['Playfair_Display'] text-4xl mb-8">Quietly powering the valley's top technical talent.</h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="text-[#C9A84C] font-['Playfair_Display'] text-4xl leading-none">"</div>
                  <p className="text-lg font-light leading-relaxed italic">
                    The strategic clarity Pinnacle brought to my EB-1A was unmatched. They didn't just organize my papers; they found the narrative thread that tied my entire ML research career together.
                  </p>
                </div>
                <div className="pl-8 border-l border-[#1A2340]/20">
                  <div className="font-bold text-sm uppercase tracking-widest text-[#1A2340]">Dr. S. K.</div>
                  <div className="text-xs text-[#1A2340]/60 mt-1">Senior Staff ML Engineer, FAANG</div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-px bg-[#1A2340]/10 border border-[#1A2340]/10">
              <div className="bg-[#FAF8F3] p-8 text-center flex flex-col justify-center items-center h-40">
                <div className="font-['Playfair_Display'] text-4xl text-[#1A2340] mb-2">94%</div>
                <div className="text-[10px] uppercase tracking-widest text-[#1A2340]/60 font-bold">RFE-Free Approval Rate</div>
              </div>
              <div className="bg-[#FAF8F3] p-8 text-center flex flex-col justify-center items-center h-40">
                <div className="font-['Playfair_Display'] text-4xl text-[#1A2340] mb-2">150+</div>
                <div className="text-[10px] uppercase tracking-widest text-[#1A2340]/60 font-bold">Petitions Architected</div>
              </div>
              <div className="bg-[#FAF8F3] p-8 text-center flex flex-col justify-center items-center h-40">
                <div className="font-['Playfair_Display'] text-4xl text-[#1A2340] mb-2">14</div>
                <div className="text-[10px] uppercase tracking-widest text-[#1A2340]/60 font-bold">Avg. Days to Premium Processing</div>
              </div>
              <div className="bg-[#FAF8F3] p-8 text-center flex flex-col justify-center items-center h-40">
                <div className="font-['Playfair_Display'] text-4xl text-[#1A2340] mb-2">EB-1A</div>
                <div className="text-[10px] uppercase tracking-widest text-[#1A2340]/60 font-bold">Our Primary Focus</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A2340] text-[#FAF8F3] pt-20 pb-8 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="font-['Playfair_Display'] font-bold text-3xl tracking-tight mb-6">
                Pinnacle³
              </div>
              <p className="text-[#FAF8F3]/60 font-light text-sm max-w-sm leading-relaxed">
                Strategic petition advisory for extraordinary technical talent. We translate deep competence into undeniable immigration narratives.
              </p>
            </div>
            
            <div>
              <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#C9A84C] mb-6">Platform</h4>
              <ul className="space-y-4 text-sm font-light text-[#FAF8F3]/80">
                <li><a href="#" className="hover:text-white transition-colors">Excellence Lab</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Evidence Vault</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Elite Blueprint</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Client Login</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#C9A84C] mb-6">Company</h4>
              <ul className="space-y-4 text-sm font-light text-[#FAF8F3]/80">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Philosophy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Journal</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-[#FAF8F3]/10 pt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-light text-[#FAF8F3]/50">
            <p>© {new Date().getFullYear()} Pinnacle Cube LLC. All rights reserved.</p>
            <div className="flex flex-wrap gap-4">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
          
          <div className="mt-8 text-[10px] text-[#FAF8F3]/30 leading-relaxed text-justify">
            Disclaimer: Pinnacle³ is an advisory service, not a law firm. We do not provide legal advice, and our services are not a substitute for the advice of an attorney. The information provided on this website and through our platform is for educational and strategic purposes only. Approval of any visa petition is strictly at the discretion of U.S. Citizenship and Immigration Services (USCIS). Past results do not guarantee future outcomes.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default EditorialPrestige;
