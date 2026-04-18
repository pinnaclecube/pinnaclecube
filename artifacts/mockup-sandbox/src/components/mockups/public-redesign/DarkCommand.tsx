import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function DarkCommand() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Navbar */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${
          scrolled
            ? "bg-[#0A0F1E]/80 backdrop-blur-md border-white/10 py-4"
            : "bg-transparent border-transparent py-6"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]">
              P³
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Pinnacle³
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#products" className="hover:text-white transition-colors">
              Products
            </a>
            <a href="#process" className="hover:text-white transition-colors">
              Process
            </a>
            <a href="#results" className="hover:text-white transition-colors">
              Results
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block"
            >
              Sign In
            </a>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-6 font-medium shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all">
              Apply Now
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-20 overflow-hidden">
        {/* Abstract Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/__mockup/images/dark-command-hero.png"
            alt="Abstract background"
            className="w-full h-full object-cover opacity-40 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F1E]/80 via-[#0A0F1E]/50 to-[#0A0F1E]"></div>
        </div>

        {/* Glow Orbs & Grid */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
        <div
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        ></div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
            <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">
              Now accepting Q4 2025 candidates
            </span>
          </div>

          <h1 className="text-6xl md:text-8xl font-extrabold text-white tracking-tight leading-[1.1] mb-8">
            Build an{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">
              undeniable
            </span>{" "}
            petition.
          </h1>

          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
            Strategic advisory for senior ML Engineers, Research Scientists, and
            Product Directors targeting EB-1A, EB-2 NIW, and O-1A visas.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button className="h-14 px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-lg font-medium shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all w-full sm:w-auto">
              Start Your Assessment
            </Button>
            <Button
              variant="outline"
              className="h-14 px-8 border-white/20 hover:bg-white/5 text-white rounded-full text-lg font-medium backdrop-blur-sm transition-all w-full sm:w-auto bg-transparent"
            >
              Explore Products
            </Button>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <div className="border-y border-white/5 bg-[#0D1117]/80 backdrop-blur-sm relative z-20 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-center gap-8 text-center md:text-left text-sm text-slate-400 uppercase tracking-widest font-semibold">
          <span className="flex items-center gap-3">
            <span className="text-indigo-500">◆</span> Not a law firm
          </span>
          <span className="hidden md:block w-px h-4 bg-white/10"></span>
          <span className="flex items-center gap-3">
            <span className="text-indigo-500">◆</span> Strategic Advisors
          </span>
          <span className="hidden md:block w-px h-4 bg-white/10"></span>
          <span className="flex items-center gap-3">
            <span className="text-indigo-500">◆</span> Exclusively Tech Elite
          </span>
        </div>
      </div>

      {/* Social Proof Ticker */}
      <section id="results" className="py-20 bg-[#0A0F1E] overflow-hidden border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
            The Standard of Excellence
          </h2>
        </div>
        <div className="relative flex overflow-x-hidden">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-16 py-4 px-8">
            {[...Array(2)].map((_, i) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center justify-center min-w-[200px]">
                  <span className="text-4xl font-bold text-white mb-2">3,000+</span>
                  <span className="text-sm text-slate-400">Candidates Evaluated</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20"></div>
                <div className="flex flex-col items-center justify-center min-w-[200px]">
                  <span className="text-4xl font-bold text-white mb-2">94%</span>
                  <span className="text-sm text-slate-400">Case Acceptance Rate</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20"></div>
                <div className="flex flex-col items-center justify-center min-w-[200px]">
                  <span className="text-4xl font-bold text-white mb-2">$120M+</span>
                  <span className="text-sm text-slate-400">Client Salary Represented</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20"></div>
                <div className="flex flex-col items-center justify-center min-w-[200px]">
                  <span className="text-4xl font-bold text-white mb-2">Top 1%</span>
                  <span className="text-sm text-slate-400">Tech Talent Network</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20"></div>
              </React.Fragment>
            ))}
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 20s linear infinite;
          }
        `}} />
      </section>

      {/* Products Section */}
      <section id="products" className="py-32 bg-[#0D1117] relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Tools for the Elite</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Everything you need to systematically build and execute a flawless immigration strategy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Excellence Lab */}
            <div className="group rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm p-8 hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="w-14 h-14 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-8">
                <div className="w-6 h-6 border-2 border-indigo-400 rounded-sm transform rotate-45"></div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Excellence Lab</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-3xl font-bold text-white">$297</span>
                <span className="text-sm text-slate-500">/ one-time</span>
              </div>
              
              <p className="text-slate-400 mb-8 h-12">
                Deep-dive tactical courses on meeting USCIS criteria. No fluff, just execution.
              </p>
              
              <ul className="space-y-4 mb-8">
                {['Media Coverage Strategies', 'Peer Review Optimization', 'Awards & Recognition Targets'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="text-indigo-400 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              
              <Button className="w-full bg-white/10 hover:bg-indigo-600 text-white border-none transition-colors">
                Explore Lab
              </Button>
            </div>

            {/* Evidence Vault */}
            <div className="group rounded-2xl bg-white/[0.03] border border-indigo-500/30 backdrop-blur-sm p-8 hover:bg-white/[0.05] transition-all duration-300 relative overflow-hidden shadow-[0_0_30px_rgba(79,70,229,0.1)]">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
              <div className="absolute top-4 right-4 bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/30">
                MOST POPULAR
              </div>
              
              <div className="w-14 h-14 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mb-8">
                <div className="w-6 h-6 border-2 border-indigo-400 rounded-sm">
                  <div className="w-full h-full border border-indigo-400 transform scale-50 rotate-45"></div>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Evidence Vault</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-3xl font-bold text-white">$497</span>
                <span className="text-sm text-slate-500">/ year</span>
              </div>
              
              <p className="text-slate-400 mb-8 h-12">
                Secure workspace for organizing petition evidence, mapped directly to USCIS criteria.
              </p>
              
              <ul className="space-y-4 mb-8">
                {['Criteria Mapping Engine', 'Expert Feedback Loops', 'AI-Assisted Drafting', 'Secure Cloud Storage'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="text-indigo-400 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                Access Vault
              </Button>
            </div>

            {/* Elite Blueprint */}
            <div className="group rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm p-8 hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="w-14 h-14 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center mb-8">
                <div className="w-6 h-6 border-2 border-slate-300 rounded-full"></div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Elite Blueprint</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-lg font-bold text-slate-300 uppercase tracking-wide">Application Only</span>
              </div>
              
              <p className="text-slate-400 mb-8 h-12">
                High-touch 1:1 strategy and complete petition drafting service. Exclusively for top-tier candidates.
              </p>
              
              <ul className="space-y-4 mb-8">
                {['Dedicated Strategic Advisor', 'End-to-End Petition Drafting', 'RFE Response Coverage', 'Priority Support Lane'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="text-indigo-400 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              
              <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 bg-transparent">
                Request Invitation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-32 bg-[#0A0F1E] border-t border-white/5 relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-3xl mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Engineering your success.</h2>
            <p className="text-xl text-slate-400">
              A systematic, deterministic approach to building your immigration petition. Leave nothing to chance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            {[
              { num: "01", title: "Assess", desc: "We evaluate your background against USCIS criteria with rigorous engineering precision." },
              { num: "02", title: "Build", desc: "Fill gaps methodically using the Excellence Lab and aggregate proof in the Evidence Vault." },
              { num: "03", title: "File", desc: "Translate your technical achievements into an undeniable narrative that adjudicators understand." }
            ].map((step, i) => (
              <div key={i} className="relative pt-8 md:pt-0">
                <div className="w-24 h-24 rounded-full bg-[#0A0F1E] border border-white/10 flex items-center justify-center text-3xl font-bold text-indigo-400 mb-8 relative z-10 mx-auto md:mx-0 shadow-[0_0_30px_rgba(79,70,229,0.15)] backdrop-blur-xl">
                  {step.num}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 text-center md:text-left">{step.title}</h3>
                <p className="text-slate-400 text-center md:text-left leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[#0D1117] border-y border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/10 to-transparent"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl font-bold text-white mb-8">Ready to secure your future?</h2>
          <p className="text-xl text-slate-400 mb-10">
            Stop guessing. Start building your undeniable petition today.
          </p>
          <Button className="h-14 px-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-lg font-medium shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all">
            Get Started Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A0F1E] pt-20 pb-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white">
                  P³
                </div>
                <span className="text-xl font-bold tracking-tight text-white">
                  Pinnacle³
                </span>
              </div>
              <p className="text-slate-400 max-w-sm mb-6">
                Premium advisory coaching for senior tech talent targeting top-tier immigration visas.
              </p>
              <div className="flex gap-4">
                {/* Social icons placeholders */}
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-slate-300">𝕏</div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-slate-300">in</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-6">Products</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Excellence Lab</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Evidence Vault</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Elite Blueprint</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-6">Company</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Success Stories</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} Pinnacle³. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-slate-500 hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors">Terms</a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/5 text-xs text-slate-600 text-center max-w-4xl mx-auto leading-relaxed">
            DISCLAIMER: Pinnacle³ is not a law firm and does not provide legal advice. We provide strategic advisory and coaching services. Use of our products and services does not guarantee visa approval. For legal advice regarding your specific immigration case, please consult with a licensed immigration attorney.
          </div>
        </div>
      </footer>
    </div>
  );
}
