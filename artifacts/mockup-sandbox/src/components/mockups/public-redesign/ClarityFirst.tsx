import React from "react";

export function ClarityFirst() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-y-auto antialiased selection:bg-[#1E2D6B] selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1E2D6B] rounded-sm flex items-center justify-center text-white text-xs font-bold leading-none">
              P³
            </div>
            <span className="font-semibold text-lg tracking-tight">Pinnacle³</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#" className="hover:text-gray-900 transition-colors">Products</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Philosophy</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Results</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Sign in</a>
            <button className="bg-[#1E2D6B] hover:bg-[#15204d] text-white px-4 py-2 rounded-md transition-colors text-sm font-medium">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-[1100px] mx-auto grid md:grid-cols-12 gap-16 items-center">
          <div className="md:col-span-6 space-y-8">
            <h1 className="text-[64px] leading-[1.1] font-bold tracking-tight text-gray-900">
              Build an undeniable petition.
            </h1>
            <p className="text-[17px] leading-relaxed text-gray-600 max-w-lg">
              Strategic advisory and precision-engineered workspaces for senior technical professionals targeting EB-1A, EB-2 NIW, and O-1A visas.
            </p>
            <div className="flex items-center gap-4">
              <button className="bg-[#1E2D6B] hover:bg-[#15204d] text-white px-6 py-3 rounded-md transition-colors font-medium">
                Start your assessment
              </button>
              <button className="text-gray-600 hover:text-gray-900 font-medium px-4 py-3">
                Explore products &rarr;
              </button>
            </div>
          </div>
          <div className="md:col-span-6 relative">
            {/* Readiness Score Mockup */}
            <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-semibold text-gray-900">Readiness Score</h3>
                  <p className="text-sm text-gray-500">EB-1A Profile Evaluation</p>
                </div>
                <div className="text-3xl font-bold text-[#1E2D6B]">82<span className="text-lg text-gray-400">/100</span></div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">Original Contributions</span>
                    <span className="text-[#1E2D6B] font-medium">Strong</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1E2D6B] w-[85%] rounded-full"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">Critical Role</span>
                    <span className="text-[#1E2D6B] font-medium">Exceptional</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1E2D6B] w-[95%] rounded-full"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">High Remuneration</span>
                    <span className="text-gray-500 font-medium">Developing</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-300 w-[45%] rounded-full"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">Judging & Peer Review</span>
                    <span className="text-[#1E2D6B] font-medium">Strong</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1E2D6B] w-[80%] rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative background elements */}
            <div className="absolute -z-10 top-1/2 right-0 w-64 h-64 bg-gray-50 rounded-full blur-3xl opacity-50 transform -translate-y-1/2 translate-x-1/4"></div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <div className="border-y border-gray-100 bg-[#F9FAFB]">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-center">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-widest text-center">
            We are not a law firm. We are strategic advisors.
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <section className="py-20 bg-white px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-gray-100">
            <div className="px-4">
              <div className="text-4xl font-bold text-gray-900 mb-2">2,400+</div>
              <div className="text-sm text-gray-500 font-medium">Candidates Advised</div>
            </div>
            <div className="px-4">
              <div className="text-4xl font-bold text-[#1E2D6B] mb-2">94%</div>
              <div className="text-sm text-gray-500 font-medium">Success Rate</div>
            </div>
            <div className="px-4">
              <div className="text-4xl font-bold text-gray-900 mb-2">14</div>
              <div className="text-sm text-gray-500 font-medium">Visa Criteria Covered</div>
            </div>
            <div className="px-4">
              <div className="text-4xl font-bold text-gray-900 mb-2">3</div>
              <div className="text-sm text-gray-500 font-medium">Countries of Origin (Top 5)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-24 bg-[#F9FAFB] px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Precision tools for high-stakes outcomes.</h2>
            <p className="text-lg text-gray-600">Everything you need to build, organize, and refine a winning petition.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Product 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-sm transition-shadow flex flex-col">
              <div className="w-3 h-3 rounded-full bg-gray-300 mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Excellence Lab</h3>
              <p className="text-gray-600 mb-6 flex-grow">Deep-dive courses on meeting complex USCIS criteria through strategic positioning.</p>
              <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-100">
                <span className="font-medium text-gray-900">$297</span>
                <a href="#" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Learn more &rarr;</a>
              </div>
            </div>

            {/* Product 2 */}
            <div className="bg-white border-2 border-[#1E2D6B] rounded-xl p-8 shadow-sm flex flex-col relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#1E2D6B] text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                Recommended
              </div>
              <div className="w-3 h-3 rounded-full bg-[#1E2D6B] mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Evidence Vault</h3>
              <p className="text-gray-600 mb-6 flex-grow">Secure workspace for organizing petition evidence, mapped to criteria with expert feedback.</p>
              <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-100">
                <span className="font-medium text-gray-900">$497</span>
                <a href="#" className="text-sm font-medium text-[#1E2D6B] hover:text-[#15204d] transition-colors">Learn more &rarr;</a>
              </div>
            </div>

            {/* Product 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-sm transition-shadow flex flex-col">
              <div className="w-3 h-3 rounded-full bg-gray-900 mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Elite Blueprint</h3>
              <p className="text-gray-600 mb-6 flex-grow">Application-only. High-touch 1:1 strategy and complete petition drafting service.</p>
              <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-100">
                <span className="font-medium text-gray-900">Custom</span>
                <a href="#" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Apply now &rarr;</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white px-6">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-16">The Methodology</h2>
          
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-6 left-6 right-6 h-px bg-gray-200 hidden md:block"></div>
            
            <div className="grid md:grid-cols-3 gap-12 relative z-10">
              <div>
                <div className="w-12 h-12 bg-white border border-gray-200 text-gray-900 rounded-full flex items-center justify-center font-semibold text-lg mb-6 shadow-sm mx-auto md:mx-0">
                  1
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center md:text-left">Assess</h3>
                <p className="text-gray-600 text-center md:text-left">
                  We evaluate your profile against current USCIS adjudication trends. You get a clear readiness score and critical gaps identified.
                </p>
              </div>
              
              <div>
                <div className="w-12 h-12 bg-white border border-gray-200 text-gray-900 rounded-full flex items-center justify-center font-semibold text-lg mb-6 shadow-sm mx-auto md:mx-0">
                  2
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center md:text-left">Build</h3>
                <p className="text-gray-600 text-center md:text-left">
                  Develop your evidence systematically. We guide you to shape your narrative, secure letters, and meet rigorous evidentiary standards.
                </p>
              </div>
              
              <div>
                <div className="w-12 h-12 bg-[#1E2D6B] border border-[#1E2D6B] text-white rounded-full flex items-center justify-center font-semibold text-lg mb-6 shadow-sm mx-auto md:mx-0">
                  3
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center md:text-left">File</h3>
                <p className="text-gray-600 text-center md:text-left">
                  Present a flawless, structurally sound petition. We organize the chaos into a compelling, undeniable case for approval.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#EEF2FF] py-32 px-6">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8 tracking-tight">Stop guessing. Start building.</h2>
          <button className="bg-[#1E2D6B] hover:bg-[#15204d] text-white px-8 py-4 rounded-md transition-colors font-medium text-lg">
            Create your account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white pt-16 pb-8 px-6 border-t border-gray-100">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-5 h-5 bg-gray-900 rounded-sm flex items-center justify-center text-white text-[10px] font-bold leading-none">
                  P³
                </div>
                <span className="font-semibold text-sm tracking-tight text-gray-900">Pinnacle³</span>
              </div>
              <p className="text-sm text-gray-500 max-w-xs">
                Strategic advisory for top-tier technical talent.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Products</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-900 transition-colors">Excellence Lab</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Evidence Vault</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Elite Blueprint</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Resources</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-900 transition-colors">Methodology</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Success Stories</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Visa Criteria Guide</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 text-sm mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-900 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Sign In</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
            <div>&copy; {new Date().getFullYear()} Pinnacle³. All rights reserved.</div>
            <div className="flex gap-4">
              <a href="#" className="hover:text-gray-600">Privacy</a>
              <a href="#" className="hover:text-gray-600">Terms</a>
            </div>
          </div>
          <div className="mt-8 text-[10px] text-gray-400 leading-relaxed max-w-4xl">
            Disclaimer: Pinnacle³ is a strategic advisory firm and not a law firm. We do not provide legal advice, legal representation, or act as your attorney. Our services are educational and organizational in nature, designed to help you prepare your professional portfolio. For legal advice regarding your specific immigration case, please consult with a licensed immigration attorney.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default ClarityFirst;
