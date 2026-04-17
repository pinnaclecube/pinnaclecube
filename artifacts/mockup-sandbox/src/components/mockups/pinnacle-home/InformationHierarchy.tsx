import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

export function InformationHierarchy() {
  return (
    <div className="font-['Plus_Jakarta_Sans'] min-h-screen bg-white text-slate-900 selection:bg-[#1E2D6B] selection:text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <div className="font-black text-2xl tracking-tighter">
            Pinnacle³
          </div>
          <div className="hidden md:flex items-center gap-8 font-semibold text-sm">
            <a href="#" className="hover:text-[#1E2D6B] transition-colors">Philosophy</a>
            <a href="#" className="hover:text-[#1E2D6B] transition-colors">Products</a>
            <a href="#" className="hover:text-[#1E2D6B] transition-colors">Sign In</a>
          </div>
        </div>
      </nav>

      <main className="pb-32">
        {/* Hero */}
        <section className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto">
           {/* Single line headline, huge weight */}
           <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none mb-8">
             Engineer your EB-1A.
           </h1>
           <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mb-12 font-medium">
             Strategic advisory for senior tech professionals to build, structure, and secure their extraordinary ability case.
           </p>
           <div className="flex flex-col items-start gap-8">
             <Button className="bg-[#1E2D6B] hover:bg-[#1E2D6B]/90 text-white rounded-none px-8 py-7 text-lg font-bold h-auto shadow-none">
               Begin Eligibility Assessment
               <ArrowRight className="ml-2 w-5 h-5" />
             </Button>
             <a href="#" className="text-sm font-bold text-slate-500 hover:text-slate-900 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-900 transition-all">
               Already a member? Sign in to your dashboard
             </a>
           </div>
        </section>

        {/* Section 01 */}
        <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-t border-slate-200">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
             <div className="md:col-span-4">
               <span className="text-[#1E2D6B] font-black text-2xl tracking-widest block mb-4">01</span>
               <h2 className="text-2xl font-bold tracking-tight text-slate-400">Our Philosophy</h2>
             </div>
             <div className="md:col-span-8">
               <h3 className="text-4xl md:text-5xl font-black mb-8 leading-tight">We are not a law firm.</h3>
               <p className="text-xl text-slate-600 mb-8 leading-relaxed font-medium">
                 Lawyers file paperwork. We build profiles. The EB-1A is not merely a legal challenge; it is a strategic one. We provide the structural coaching required for ML Engineers, Research Scientists, and Product Directors to systematically meet the USCIS criteria before legal counsel ever gets involved.
               </p>
             </div>
           </div>
        </section>

        {/* Section 02 */}
        <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-t border-slate-200">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
             <div className="md:col-span-4">
               <span className="text-[#1E2D6B] font-black text-2xl tracking-widest block mb-4">02</span>
               <h2 className="text-2xl font-bold tracking-tight text-slate-400">The Framework</h2>
             </div>
             <div className="md:col-span-8">
               <p className="text-xl text-slate-600 leading-relaxed font-medium">
                 Three discrete products designed to take you from initial assessment to final documentation. Choose your entry point based on your current readiness.
               </p>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             {/* Excellence Lab */}
             <div className="border-2 border-slate-200 p-8 flex flex-col h-full hover:border-[#1E2D6B] transition-colors group bg-white">
               <h3 className="text-3xl font-black mb-2">Excellence Lab</h3>
               <p className="text-slate-500 font-bold mb-10 flex-grow uppercase tracking-wider text-sm">Profile Building & Strategy</p>
               
               <ul className="space-y-4 mb-10">
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-[#1E2D6B] shrink-0 mt-0.5" />
                   Intelligent lesson generation
                 </li>
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-[#1E2D6B] shrink-0 mt-0.5" />
                   Action item tracking
                 </li>
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-[#1E2D6B] shrink-0 mt-0.5" />
                   Criteria alignment mapping
                 </li>
               </ul>
               <Button variant="outline" className="w-full rounded-none border-2 border-slate-200 font-bold py-6 group-hover:border-[#1E2D6B] group-hover:bg-[#1E2D6B] group-hover:text-white transition-all text-base">
                 Explore Lab
               </Button>
             </div>

             {/* Evidence Vault */}
             <div className="border-2 border-slate-200 p-8 flex flex-col h-full hover:border-[#1E2D6B] transition-colors group bg-white">
               <h3 className="text-3xl font-black mb-2">Evidence Vault</h3>
               <p className="text-slate-500 font-bold mb-10 flex-grow uppercase tracking-wider text-sm">Document Synthesis</p>
               
               <ul className="space-y-4 mb-10">
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-[#1E2D6B] shrink-0 mt-0.5" />
                   AI-assisted drafting
                 </li>
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-[#1E2D6B] shrink-0 mt-0.5" />
                   Google Drive integration
                 </li>
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-[#1E2D6B] shrink-0 mt-0.5" />
                   Reference letter templates
                 </li>
               </ul>
               <Button variant="outline" className="w-full rounded-none border-2 border-slate-200 font-bold py-6 group-hover:border-[#1E2D6B] group-hover:bg-[#1E2D6B] group-hover:text-white transition-all text-base">
                 Explore Vault
               </Button>
             </div>

             {/* Elite Blueprint */}
             <div className="border-2 border-slate-900 p-8 flex flex-col h-full hover:border-[#1E2D6B] transition-colors group bg-slate-50 relative">
               <div className="absolute top-0 right-0 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest py-1 px-3">Premium</div>
               <h3 className="text-3xl font-black mb-2">Elite Blueprint</h3>
               <p className="text-slate-500 font-bold mb-10 flex-grow uppercase tracking-wider text-sm">End-to-End Program</p>
               
               <ul className="space-y-4 mb-10">
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
                   Full access to Lab & Vault
                 </li>
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
                   1:1 Strategic coaching
                 </li>
                 <li className="flex items-start gap-3 text-base font-semibold">
                   <Check className="w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
                   Final attorney handoff
                 </li>
               </ul>
               <Button className="w-full rounded-none font-bold py-6 bg-slate-900 text-white hover:bg-[#1E2D6B] transition-all text-base shadow-none">
                 Apply for Blueprint
               </Button>
             </div>
           </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-12 px-6 md:px-12 text-sm font-bold text-slate-400 flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-4">
        <div>© 2024 Pinnacle³. All rights reserved.</div>
        <div className="flex gap-8">
          <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Disclaimer</a>
        </div>
      </footer>
    </div>
  );
}

export default InformationHierarchy;
