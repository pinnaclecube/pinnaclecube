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
