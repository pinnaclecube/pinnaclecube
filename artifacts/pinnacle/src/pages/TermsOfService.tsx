import { PublicLayout } from "@/components/layout/PublicLayout";

export default function TermsOfService() {
  const year = new Date().getFullYear();

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-[#1E2D6B] mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: January 1, {year}</p>

        <div className="prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Pinnacle³ ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to all terms, you may not access the Platform. These terms apply to all visitors, users, and others who access or use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Nature of Service — Not a Law Firm</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pinnacle³ is an <strong>advisory coaching platform</strong>, not a law firm, and is not a substitute for legal counsel. We do not provide legal advice, legal representation, or any services that constitute the practice of law. Our coaches and AI tools provide educational content, strategic frameworks, profile assessments, and document drafting assistance only.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              No information, content, or communication on this platform creates an attorney-client relationship. You should consult a licensed immigration attorney for all legal matters related to your visa petition.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Products and Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Pinnacle³ offers the following advisory products:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Excellence Lab</strong> — A structured curriculum of courses and frameworks for building an extraordinary ability profile.</li>
              <li><strong>Evidence Engine</strong> — A secure repository for organizing, tracking, and strengthening your evidence portfolio.</li>
              <li><strong>Elite Blueprint</strong> — A premium one-on-one advisory engagement for high-achieving professionals seeking a comprehensive case strategy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Payment and Billing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Paid products are billed at the time of purchase. All prices are listed in USD. We use Stripe to process payments securely. By purchasing, you authorize us to charge your payment method for the total amount shown at checkout.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Refund Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Due to the digital nature of our products, all sales are final unless otherwise stated at the time of purchase. If you believe you were charged in error, contact us within 7 days of your purchase. Refund eligibility for Elite Blueprint engagements is governed by the terms of your specific engagement agreement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. User Accounts and Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the security of your account credentials. You agree not to share your account, impersonate another person, use the platform for any unlawful purpose, or attempt to gain unauthorized access to any part of the platform or its infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Artificial Intelligence Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Platform uses AI models (including Anthropic Claude) to generate educational content, evidence summaries, lesson material, and draft documents. All AI-generated content is provided for informational purposes only. It may contain inaccuracies, omissions, or errors. You must independently verify all AI-generated content with a licensed immigration attorney before using it in any official filing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content, frameworks, curricula, and materials on the Platform are the intellectual property of Pinnacle³ and are protected by applicable copyright and intellectual property laws. You may use content solely for your personal, non-commercial use in connection with your own immigration profile. Resale, redistribution, or commercial use is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Pinnacle³ shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities. Our total liability to you for any claim arising from use of the Platform shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account at our discretion if you violate these terms or engage in conduct harmful to the Platform or other users. You may close your account at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by the laws of the United States, without regard to conflict of law provisions. Any disputes shall be resolved through binding arbitration, except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms at any time. We will notify registered users of material changes via email or an in-platform notice. Your continued use of the Platform after changes are posted constitutes your acceptance of the updated terms.
            </p>
          </section>

          <section className="border-t border-border pt-8 space-y-2">
            <p className="text-muted-foreground text-sm">
              Questions about these Terms? Contact us at any time:
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Pinnacle³</strong><br />
              470 Olde Worthington Rd<br />
              Westerville, OH 43082<br />
              <a href="mailto:support@pinnaclecube.com" className="text-[#1E2D6B] hover:underline">support@pinnaclecube.com</a>
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
