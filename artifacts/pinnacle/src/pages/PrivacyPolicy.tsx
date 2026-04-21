import { PublicLayout } from "@/components/layout/PublicLayout";

export default function PrivacyPolicy() {
  const year = new Date().getFullYear();

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-[#1E2D6B] mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: January 1, {year}</p>

        <div className="prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pinnacle³ ("we," "us," or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains what information we collect, how we use it, who we share it with, and your rights with respect to your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We collect the following categories of information:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Account information</strong> — Name, email address, and password when you register.</li>
              <li><strong>Profile information</strong> — Current role, employer, visa status, and target visa type provided during onboarding.</li>
              <li><strong>Evidence and documents</strong> — Files you upload to the Evidence Engine, including publications, awards, letters, and supporting materials.</li>
              <li><strong>Usage data</strong> — Pages visited, features used, lesson completion, and interactions within the platform.</li>
              <li><strong>Payment information</strong> — Processed entirely by Stripe. We do not store your card details.</li>
              <li><strong>Communications</strong> — Messages and feedback submitted through the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>To provide and personalize the advisory services you have purchased.</li>
              <li>To generate AI-powered insights, evidence analysis, and lesson content tailored to your profile.</li>
              <li>To process payments and manage your subscription or product access.</li>
              <li>To communicate with you about your account, case progress, or platform updates.</li>
              <li>To improve our platform and develop new features.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We share data with the following trusted third-party services:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Anthropic</strong> — AI model provider. Your evidence descriptions and profile data are sent to Anthropic's API to generate AI analysis and content. Anthropic's usage policies apply.</li>
              <li><strong>Google Drive</strong> — Documents and evidence files are stored in a secured Google Drive folder linked to your account.</li>
              <li><strong>Stripe</strong> — Payment processing. Stripe collects and stores payment information under their own privacy policy.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              We do not sell your personal data to any third party for marketing or advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored on secured servers with access controls and encryption in transit. We use industry-standard security practices. However, no system is completely secure, and we cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your account data for as long as your account is active. If you close your account, we will delete or anonymize your data within 90 days, except where retention is required by law or for legitimate business purposes such as fraud prevention.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data ("right to be forgotten").</li>
              <li>Object to or restrict certain processing of your data.</li>
              <li>Request portability of your data in a machine-readable format.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise any of these rights, contact us through the platform. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use session cookies solely to maintain your authenticated session. We do not use third-party tracking cookies or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are intended for adults (18+) pursuing professional immigration pathways. We do not knowingly collect data from anyone under 18 years of age.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of material changes via email or a notice within the platform. Your continued use of the Platform after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="border-t border-border pt-8 space-y-2">
            <p className="text-muted-foreground text-sm">
              Questions about this Privacy Policy? Contact us at any time:
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
