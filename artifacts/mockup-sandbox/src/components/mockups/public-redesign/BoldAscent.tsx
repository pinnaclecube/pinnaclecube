import React from 'react';

export function BoldAscent() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#F59E0B] selection:text-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#1E2D6B]/90 backdrop-blur-md border-b border-white/10 transition-all duration-300">
        <div className="max-w-[1100px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-2xl font-extrabold tracking-tight">
              Pinnacle<span className="text-[#F59E0B] ml-0.5 text-3xl leading-none relative -top-1">³</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-white/90 text-sm font-medium">
            <a href="#products" className="hover:text-white transition-colors">Products</a>
            <a href="#process" className="hover:text-white transition-colors">How it Works</a>
            <a href="#proof" className="hover:text-white transition-colors">Success Stories</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/90 hover:text-white text-sm font-medium hidden md:block">Log in</a>
            <button className="bg-white text-[#1E2D6B] px-6 py-2.5 rounded font-bold text-sm hover:bg-gray-100 transition-colors">
              Apply Now
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 bg-[#1E2D6B] overflow-hidden">
        {/* Abstract Background Image */}
        <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
          <img 
            src="/__mockup/images/bold-ascent-hero.png" 
            alt="Ascending trajectory" 
            className="w-full h-full object-cover object-center"
          />
        </div>
        
        {/* Decorative giant 3 */}
        <div className="absolute -right-20 -bottom-20 text-[400px] font-black text-white/[0.03] leading-none pointer-events-none select-none">
          ³
        </div>

        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl lg:text-[88px] font-extrabold text-white leading-[1.05] tracking-tight mb-8">
              Your immigration case should be extraordinary. <br />
              <span className="text-[#F59E0B] block mt-4">We make sure it is.</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/80 font-medium mb-12 max-w-2xl leading-relaxed">
              We don't just fill out forms. We strategically position senior technical professionals as undeniable candidates for EB-1A, EB-2 NIW, and O-1A visas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="bg-white text-[#1E2D6B] px-8 py-4 rounded font-extrabold text-lg hover:bg-gray-100 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-black/10">
                Start Your Assessment
              </button>
              <button className="bg-transparent text-white border-2 border-white/30 px-8 py-4 rounded font-bold text-lg hover:border-white hover:bg-white/5 transition-all">
                Explore Programs
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Strip */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-4">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/90 text-lg md:text-xl font-serif italic tracking-wide">
            "Not a law firm. A strategic ally."
          </p>
        </div>
      </div>

      {/* Products Section */}
      <section id="products" className="py-24 md:py-32 bg-[#0A1128]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Built for Excellence</h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Three tiers of engagement. One uncompromising standard. Choose how you want to build your case.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Product 1 */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-xl relative hover:bg-white/10 transition-colors group">
              <div className="absolute -top-5 -left-5 w-12 h-12 bg-[#1E2D6B] text-white rounded flex items-center justify-center font-bold text-xl border border-white/20 shadow-lg">01</div>
              <h3 className="text-2xl font-bold text-white mb-2 mt-4">Excellence Lab</h3>
              <div className="text-3xl font-extrabold text-[#F59E0B] mb-6">$297</div>
              <p className="text-white/70 mb-8 min-h-[80px]">
                Deep-dive courses on meeting USCIS criteria. Learn exactly how to generate media coverage, peer review, and awards.
              </p>
              <ul className="space-y-4 mb-8">
                {['Strategic frameworks', 'Templates & examples', 'Criteria breakdown', 'Self-paced learning'].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-white/80">
                    <span className="text-[#818CF8] mt-1">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded border border-white/20 text-white font-bold group-hover:bg-white group-hover:text-[#0A1128] transition-colors">
                Join the Lab
              </button>
            </div>

            {/* Product 2 */}
            <div className="bg-white border-2 border-[#1E2D6B] p-8 rounded-xl relative transform md:-translate-y-4 shadow-2xl">
              <div className="absolute -top-5 -left-5 w-12 h-12 bg-[#1E2D6B] text-white rounded flex items-center justify-center font-bold text-xl shadow-lg">02</div>
              <div className="absolute top-4 right-4 bg-[#F59E0B]/20 text-[#D97706] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</div>
              <h3 className="text-2xl font-bold text-[#0A1128] mb-2 mt-4">Evidence Vault</h3>
              <div className="text-3xl font-extrabold text-[#1E2D6B] mb-6">$497</div>
              <p className="text-slate-600 mb-8 min-h-[80px]">
                Secure workspace for organizing petition evidence, mapped to criteria with expert feedback on your profile.
              </p>
              <ul className="space-y-4 mb-8">
                {['Secure document storage', 'Criteria mapping tool', 'Expert profile review', 'Readiness scoring'].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 font-medium">
                    <span className="text-[#1E2D6B] mt-1">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded bg-[#1E2D6B] text-white font-bold hover:bg-[#0F1F4A] transition-colors">
                Access Vault
              </button>
            </div>

            {/* Product 3 */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-xl relative hover:bg-white/10 transition-colors group">
              <div className="absolute -top-5 -left-5 w-12 h-12 bg-[#1E2D6B] text-white rounded flex items-center justify-center font-bold text-xl border border-white/20 shadow-lg">03</div>
              <h3 className="text-2xl font-bold text-white mb-2 mt-4">Elite Blueprint</h3>
              <div className="text-xl font-bold text-white/50 mb-6 uppercase tracking-wider mt-2">Application Only</div>
              <p className="text-white/70 mb-8 min-h-[80px]">
                High-touch 1:1 strategy and petition drafting service. For exceptional candidates who want a fully managed process.
              </p>
              <ul className="space-y-4 mb-8">
                {['1:1 Strategy sessions', 'Full petition drafting', 'Recommendation letters', 'Premium support'].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-white/80">
                    <span className="text-[#818CF8] mt-1">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded border border-white/20 text-white font-bold group-hover:bg-white group-hover:text-[#0A1128] transition-colors">
                Apply for Elite
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="process" className="py-24 md:py-32 bg-slate-50 overflow-hidden relative">
        {/* Decorative background element */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-100 rounded-full blur-3xl -z-10"></div>
        
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#0A1128] mb-6">The Methodology</h2>
            <p className="text-xl text-slate-600 max-w-2xl">
              A systematic approach to building an undeniable immigration petition. No guesswork. Just strategy.
            </p>
          </div>

          <div className="relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute left-12 top-0 bottom-0 w-1 bg-slate-200 z-0"></div>
            
            <div className="space-y-16 md:space-y-24 relative z-10">
              {/* Step 1 */}
              <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-start md:ml-0">
                <div className="w-24 h-24 bg-[#1E2D6B] text-white rounded-2xl flex items-center justify-center text-4xl font-black shadow-xl shrink-0">1</div>
                <div className="pt-2 max-w-2xl">
                  <h3 className="text-3xl font-bold text-[#0A1128] mb-4">Assess & Strategize</h3>
                  <p className="text-lg text-slate-600 leading-relaxed">
                    We evaluate your background against USCIS criteria with brutal honesty. We identify gaps, select your strongest angle, and build a roadmap to elevate your profile before you even think about filing.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-start md:ml-24">
                <div className="w-24 h-24 bg-[#1E2D6B] text-white rounded-2xl flex items-center justify-center text-4xl font-black shadow-xl shrink-0">2</div>
                <div className="pt-2 max-w-2xl">
                  <h3 className="text-3xl font-bold text-[#0A1128] mb-4">Build the Evidence</h3>
                  <p className="text-lg text-slate-600 leading-relaxed">
                    Using our Excellence Lab and Evidence Vault, you execute the strategy. You publish, present, review, and gather. We provide the frameworks, templates, and feedback to ensure every piece of evidence is bulletproof.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-start md:ml-48">
                <div className="w-24 h-24 bg-[#1E2D6B] text-white rounded-2xl flex items-center justify-center text-4xl font-black shadow-xl shrink-0">3</div>
                <div className="pt-2 max-w-2xl">
                  <h3 className="text-3xl font-bold text-[#0A1128] mb-4">Draft & File</h3>
                  <p className="text-lg text-slate-600 leading-relaxed">
                    When the profile is undeniable, we construct the narrative. We draft the petition and recommendation letters (Elite tier) or guide you through the process, ensuring the final submission is a masterpiece of technical advocacy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section id="proof" className="py-24 md:py-32 bg-[#1E2D6B] relative overflow-hidden">
        {/* Decorative 3 */}
        <div className="absolute -left-20 top-0 text-[300px] font-black text-white/[0.03] leading-none pointer-events-none select-none">
          ³
        </div>
        
        <div className="max-w-[1100px] mx-auto px-6 relative z-10 text-center">
          <div className="inline-block mb-8 text-5xl text-[#F59E0B]">❝</div>
          <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-4xl mx-auto mb-12">
            Pinnacle³ didn't just help me file a petition; they helped me understand my own value. The strategic rigor they applied to my EB-1A case was on par with the engineering standards at top-tier tech companies. Approved in 11 days.
          </h2>
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white/10 rounded-full mb-4 flex items-center justify-center text-white font-bold text-xl border border-white/20">
              AR
            </div>
            <div className="text-[#F59E0B] font-bold text-xl tracking-wide">Staff Machine Learning Engineer</div>
            <div className="text-white/60 font-medium mt-1">FAANG Company</div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-5xl md:text-6xl font-extrabold text-[#0A1128] mb-8 tracking-tight">
            Ready to ascend?
          </h2>
          <p className="text-xl text-slate-600 mb-12 font-medium">
            Stop guessing what USCIS wants. Start building an undeniable case with strategic precision.
          </p>
          <button className="bg-[#1E2D6B] text-white px-10 py-5 rounded font-extrabold text-xl hover:bg-[#0F1F4A] transition-all hover:-translate-y-1 shadow-2xl hover:shadow-[#1E2D6B]/30">
            Start Your Assessment Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F1F4A] pt-20 pb-10 border-t border-white/10">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="text-white text-3xl font-extrabold tracking-tight mb-6">
                Pinnacle<span className="text-[#F59E0B] ml-0.5 text-4xl leading-none relative -top-1">³</span>
              </div>
              <p className="text-white/60 max-w-sm leading-relaxed mb-6">
                Premium advisory platform for senior technical professionals targeting extraordinary ability visas.
              </p>
              <div className="text-sm font-serif italic text-white/40">
                Not a law firm. A strategic ally.
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 tracking-wider text-sm uppercase">Products</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-white/60 hover:text-white transition-colors">Excellence Lab</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors">Evidence Vault</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors">Elite Blueprint</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 tracking-wider text-sm uppercase">Company</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-white/60 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors">Success Stories</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors">Log In</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/40 text-center md:text-left">
            <div>
              &copy; {new Date().getFullYear()} Pinnacle³. All rights reserved.
            </div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            </div>
            <div className="max-w-md mt-4 md:mt-0 text-[10px] leading-relaxed">
              Disclaimer: Pinnacle³ is an educational and strategic advisory platform, not a law firm. We do not provide legal advice, and our services do not establish an attorney-client relationship. For legal advice, consult a qualified immigration attorney.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
