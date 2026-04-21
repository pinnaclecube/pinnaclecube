import { Link } from "wouter";
import { Logo } from "@/components/ui/logo";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0F1F4A] text-white">
      <div className="max-w-[1100px] mx-auto px-6 pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2 space-y-4">
            <Logo href="/" variant="light" />
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Premium advisory platform for senior technical professionals targeting extraordinary ability visas.
            </p>
            <p className="text-sm font-serif italic text-white/40">
              Not a law firm. A strategic ally.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://www.linkedin.com/company/pinnaclecube/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pinnacle³ on LinkedIn"
                className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 hover:bg-[#0A66C2] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Products</h3>
            <ul className="space-y-3">
              <li><FooterLink href="/excellence-lab">Excellence Lab</FooterLink></li>
              <li><FooterLink href="/evidence-vault">Evidence Vault</FooterLink></li>
              <li><FooterLink href="/elite-blueprint">Elite Blueprint</FooterLink></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Company</h3>
            <ul className="space-y-3">
              <li><FooterLink href="/how-it-works">How It Works</FooterLink></li>
              <li><FooterLink href="/resources">Resource Hub</FooterLink></li>
              <li><FooterLink href="/instant-profile-insight/start">Free Profile Insight</FooterLink></li>
              <li><FooterLink href="/quiz">Visa Readiness Quiz</FooterLink></li>
              <li><FooterLink href="/privacy-policy">Privacy Policy</FooterLink></li>
              <li><FooterLink href="/terms">Terms of Service</FooterLink></li>
              <li><FooterLink href="/disclaimer">Disclaimer</FooterLink></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-white/40 text-xs">
            &copy; {year} Pinnacle³. All rights reserved.
          </p>
          <p className="text-white/30 text-[10px] max-w-md leading-relaxed">
            Pinnacle³ is an educational and strategic advisory platform, not a law firm. We do not provide legal advice, and our services do not establish an attorney-client relationship.{" "}
            <Link href="/disclaimer" className="underline hover:text-white/50 transition-colors">
              Full disclaimer
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-white/60 hover:text-white text-sm transition-colors">
      {children}
    </Link>
  );
}
