import React from "react";
import { ArrowRight, ChevronRight, CheckCircle2, ShieldCheck, Clock, Check, ArrowUpRight } from "lucide-react";

export function InteractionAffordance() {
  return (
    <div className="font-['Plus_Jakarta_Sans'] min-h-screen bg-slate-50 text-slate-900 selection:bg-[#1E2D6B] selection:text-white">
      {/* Sticky Trust Bar */}
      <div className="bg-slate-900 text-slate-50 py-2 px-4 text-sm font-medium flex justify-center items-center gap-6 sticky top-0 z-50">
        <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-400" /> No commitment required</span>
        <span className="hidden sm:flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Expert advisory</span>
        <span className="hidden md:flex items-center gap-2"><Clock className="w-4 h-4 text-amber-400" /> 48-hour response</span>
      </div>

      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white sticky top-9 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-8 h-8 bg-[#1E2D6B] rounded flex items-center justify-center text-white font-bold text-xl group-hover:bg-blue-800 transition-colors">
              P³
            </div>
            <span className="font-bold text-xl tracking-tight text-[#1E2D6B]">Pinnacle</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 font-semibold text-slate-600">
            <a href="#philosophy" className="hover:text-[#1E2D6B] flex items-center gap-1 group py-2">
              Philosophy <ChevronRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-[#1E2D6B]" />
            </a>
            <a href="#products" className="hover:text-[#1E2D6B] flex items-center gap-1 group py-2">
              Products <ChevronRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-[#1E2D6B]" />
            </a>
            <a href="#results" className="hover:text-[#1E2D6B] flex items-center gap-1 group py-2">
              Results <ChevronRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-[#1E2D6B]" />
            </a>
          </div>

          <button className="bg-[#1E2D6B] hover:bg-blue-900 text-white px-6 py-3 rounded-md font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95">
            Start Assessment <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-white py-24 lg:py-32 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl">
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
            EB-1A Approval is a Strategy, <span className="text-[#1E2D6B]">Not a Lottery.</span>
          </h1>
          <p className="text-xl text-slate-600 mb-12 leading-relaxed max-w-3xl mx-auto font-medium">
            Premium strategic coaching for senior tech professionals. We help ML Engineers, Research Scientists, and Product Directors build undeniable evidence portfolios.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto px-4 sm:px-0">
            <button className="w-full sm:w-auto bg-[#1E2D6B] hover:bg-blue-900 text-white text-lg px-8 py-4 rounded-lg font-bold transition-all shadow-xl shadow-blue-900/20 hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-3 active:scale-95 group border-2 border-[#1E2D6B]">
              Take the Free Assessment
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto bg-white hover:bg-slate-50 text-[#1E2D6B] text-lg px-8 py-4 rounded-lg font-bold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-3 active:scale-95 group border-2 border-slate-300 hover:border-[#1E2D6B]">
              Explore Our Products
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section id="philosophy" className="py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-sm mb-6 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> Our Philosophy
              </div>
              <h2 className="text-4xl font-extrabold text-slate-900 mb-6 leading-tight">
                We are <span className="underline decoration-4 decoration-red-400">not</span> a law firm.
              </h2>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed font-medium">
                Lawyers format evidence. We tell you exactly what evidence to build. Our strategic coaching turns borderline profiles into undeniable EB-1A cases before you ever hire an attorney.
              </p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-1 rounded-full text-emerald-700 mt-1">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-lg text-slate-700 font-semibold">Actionable roadmaps, not legal jargon</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-1 rounded-full text-emerald-700 mt-1">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-lg text-slate-700 font-semibold">Profile building tailored for tech professionals</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-1 rounded-full text-emerald-700 mt-1">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-lg text-slate-700 font-semibold">Independent advice without retainer pressure</span>
                </li>
              </ul>
              
              <button className="bg-white border-2 border-[#1E2D6B] text-[#1E2D6B] hover:bg-[#1E2D6B] hover:text-white px-8 py-4 rounded-lg font-bold text-lg transition-all shadow-sm hover:shadow-lg flex items-center gap-3 group active:scale-95">
                Read our full methodology
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
            <div className="bg-[#1E2D6B] rounded-2xl p-10 lg:p-14 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldCheck className="w-64 h-64" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10">Ready to find out where you stand?</h3>
              <p className="text-blue-200 text-lg mb-8 relative z-10 font-medium">Take our 5-minute assessment to get a realistic evaluation of your EB-1A chances.</p>
              
              <button className="w-full bg-white text-[#1E2D6B] hover:bg-slate-100 px-6 py-4 rounded-lg font-extrabold text-xl transition-all shadow-lg flex items-center justify-between group active:scale-95 relative z-10">
                <span>Start Assessment</span>
                <div className="bg-blue-100 p-2 rounded-md group-hover:bg-blue-200 transition-colors">
                  <ArrowRight className="w-6 h-6 text-[#1E2D6B]" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Choose Your Path</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto font-medium">We offer exactly what you need at every stage of your EB-1A journey.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Product 1 */}
            <div className="border-2 border-slate-200 rounded-2xl p-8 bg-white hover:border-[#1E2D6B] transition-colors group flex flex-col h-full relative cursor-pointer hover:shadow-xl">
              <div className="absolute top-8 right-8 text-slate-300 group-hover:text-[#1E2D6B] transition-colors">
                <ArrowUpRight className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Excellence Lab</h3>
              <p className="text-slate-600 mb-6 min-h-[80px] font-medium text-lg">
                For professionals 1-3 years out. Build your profile proactively with targeted coaching.
              </p>
              <ul className="space-y-3 mb-8 flex-grow text-slate-700 font-medium">
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-[#1E2D6B] shrink-0" /> Monthly strategic sprints</li>
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-[#1E2D6B] shrink-0" /> Publication planning</li>
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-[#1E2D6B] shrink-0" /> Judging opportunity matching</li>
              </ul>
              <button className="w-full bg-slate-100 group-hover:bg-[#1E2D6B] text-slate-900 group-hover:text-white px-6 py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 active:scale-95">
                Explore Lab <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Product 2 - Highlighted */}
            <div className="border-2 border-[#1E2D6B] rounded-2xl p-8 bg-blue-50/50 hover:bg-blue-50 transition-colors group flex flex-col h-full relative cursor-pointer shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#1E2D6B] text-white px-4 py-1 rounded-full text-sm font-bold tracking-wide uppercase">
                Most Popular
              </div>
              <div className="absolute top-8 right-8 text-[#1E2D6B]">
                <ArrowUpRight className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-extrabold text-[#1E2D6B] mb-2">Evidence Vault</h3>
              <p className="text-slate-700 mb-6 min-h-[80px] font-medium text-lg">
                Securely gather, organize, and evaluate your evidence against strict USCIS criteria.
              </p>
              <ul className="space-y-3 mb-8 flex-grow text-slate-800 font-semibold">
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-[#1E2D6B] shrink-0" /> AI-assisted criteria mapping</li>
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-[#1E2D6B] shrink-0" /> Document quality scoring</li>
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-[#1E2D6B] shrink-0" /> Gap analysis report</li>
              </ul>
              <button className="w-full bg-[#1E2D6B] hover:bg-blue-800 text-white px-6 py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-md">
                Start Vaulting <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Product 3 */}
            <div className="border-2 border-slate-200 rounded-2xl p-8 bg-white hover:border-slate-800 transition-colors group flex flex-col h-full relative cursor-pointer hover:shadow-xl">
              <div className="absolute top-8 right-8 text-slate-300 group-hover:text-slate-800 transition-colors">
                <ArrowUpRight className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Elite Blueprint</h3>
              <p className="text-slate-600 mb-6 min-h-[80px] font-medium text-lg">
                Ready to file? Get a comprehensive final review before handing over to your attorney.
              </p>
              <ul className="space-y-3 mb-8 flex-grow text-slate-700 font-medium">
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-slate-800 shrink-0" /> Petition letter review</li>
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-slate-800 shrink-0" /> Exhibit index optimization</li>
                <li className="flex gap-2 items-start"><Check className="w-5 h-5 text-slate-800 shrink-0" /> Recommendation letter edits</li>
              </ul>
              <button className="w-full bg-slate-800 hover:bg-slate-900 text-white px-6 py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-md">
                View Blueprint <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-slate-900 py-24 border-t-8 border-[#1E2D6B]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-8">Stop guessing. Start building.</h2>
          <p className="text-xl text-slate-300 mb-12 font-medium">
            Join hundreds of tech professionals who secured their EB-1A with our strategic guidance.
          </p>
          <button className="bg-[#1E2D6B] hover:bg-blue-500 text-white text-xl px-10 py-5 rounded-lg font-extrabold transition-all shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1 flex items-center justify-center gap-3 mx-auto group active:scale-95 border-2 border-blue-400">
            Take Your Free Assessment
            <ArrowRight className="w-7 h-7 group-hover:translate-x-2 transition-transform" />
          </button>
          <p className="text-slate-400 mt-6 text-sm font-semibold flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4" /> 100% Free • No Obligation • Instant Results
          </p>
        </div>
      </section>
    </div>
  );
}
