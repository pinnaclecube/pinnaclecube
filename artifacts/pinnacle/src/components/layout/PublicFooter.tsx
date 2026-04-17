import { Link } from "wouter";

function FooterLogo() {
  return (
    <Link href="/" className="font-bold text-xl tracking-tight flex items-center select-none no-underline">
      <span style={{ color: '#ffffff' }}>[pinnacle]</span>
      <sup style={{ color: '#94a3b8', fontSize: '0.6em', marginTop: '-0.5em' }}>³</sup>
    </Link>
  );
}

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}

function FooterLink({ href, children, external }: FooterLinkProps) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-400 hover:text-white text-sm transition-colors"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="text-slate-400 hover:text-white text-sm transition-colors">
      {children}
    </Link>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0F1629] text-white">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="md:col-span-1 space-y-4">
            <FooterLogo />
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Structured guidance for extraordinary talent pursuing EB-1A, EB-2 NIW, and O-1A pathways.
            </p>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Company</h3>
            <ul className="space-y-3">
              <li><FooterLink href="/how-it-works">About</FooterLink></li>
              <li><FooterLink href="/how-it-works">How It Works</FooterLink></li>
              <li><FooterLink href="/privacy-policy">Privacy Policy</FooterLink></li>
              <li><FooterLink href="/terms">Terms of Service</FooterLink></li>
              <li><FooterLink href="/disclaimer">Disclaimer</FooterLink></li>
            </ul>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Products</h3>
            <ul className="space-y-3">
              <li><FooterLink href="/excellence-lab">Excellence Lab</FooterLink></li>
              <li><FooterLink href="/elite-blueprint">Elite Blueprint</FooterLink></li>
              <li><FooterLink href="/evidence-vault">Evidence Vault</FooterLink></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Resources</h3>
            <ul className="space-y-3">
              <li><FooterLink href="/instant-profile-insight/start">Get Instant Profile Insight</FooterLink></li>
              <li><FooterLink href="/quiz">Visa Readiness Quiz</FooterLink></li>
              <li><FooterLink href="/products">All Products</FooterLink></li>
              <li><FooterLink href="/login">Login</FooterLink></li>
              <li><FooterLink href="/register">Create Account</FooterLink></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-slate-500 text-xs">
            © {year} Pinnacle³. All rights reserved.
          </p>
          <p className="text-slate-500 text-xs max-w-md text-right">
            This platform provides structured guidance and does not constitute legal advice.{" "}
            <Link href="/disclaimer" className="underline hover:text-slate-300 transition-colors">
              Full disclaimer
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
