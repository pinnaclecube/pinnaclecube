import { PublicLayout } from "@/components/layout/PublicLayout";
import { AlertTriangle } from "lucide-react";

export default function Disclaimer() {
  const year = new Date().getFullYear();

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-7 h-7 text-amber-500 shrink-0" />
          <h1 className="text-4xl font-bold text-[#1E2D6B]">Disclaimer</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-10">Last updated: January 1, {year}</p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-6 py-5 mb-10">
          <p className="text-amber-900 font-semibold text-base">
            Pinnacle³ is an advisory coaching service — not a law firm, and not a substitute for licensed immigration legal counsel.
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Not Legal Advice</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nothing on this platform — including but not limited to courses, lessons, evidence analysis, profile assessments, petition drafts, exhibit outlines, recommendation letter templates, AI-generated content, or communications from our team — constitutes legal advice. All content is provided for educational, informational, and strategic coaching purposes only.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Immigration law is complex and fact-specific. Your eligibility for any visa classification depends on your individual circumstances and the evolving policies of USCIS and the U.S. Department of State. Only a licensed immigration attorney who has reviewed your specific situation can provide legal advice about your case.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">No Attorney-Client Relationship</h2>
            <p className="text-muted-foreground leading-relaxed">
              Use of this platform does not create an attorney-client relationship between you and Pinnacle³, any of its staff, coaches, or affiliated advisors. No communication through this platform — written, verbal, or AI-generated — should be construed as creating such a relationship.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Artificial Intelligence Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pinnacle³ uses large language AI models, including Anthropic Claude, to generate lessons, evidence summaries, profile insights, petition drafts, and other content. AI-generated output:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
              <li>May contain factual errors, outdated information, or hallucinations.</li>
              <li>Does not account for recent changes in USCIS adjudication trends, policy memoranda, or regulatory guidance.</li>
              <li>Is not reviewed by a licensed attorney unless explicitly stated.</li>
              <li><strong>Must be independently verified by a licensed immigration attorney before use in any official USCIS filing, petition, or legal submission.</strong></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">No Guarantee of Immigration Outcomes</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pinnacle³ makes no representations or warranties about the likelihood of success of any visa petition. Immigration outcomes depend on many factors outside our control, including individual case merits, USCIS adjudication discretion, policy changes, and other variables. Past client outcomes are not indicative of future results.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Consult a Licensed Attorney</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strongly encourage all users to engage a licensed immigration attorney to review, advise on, and file any immigration petition. Our platform is designed to work alongside licensed legal counsel — not to replace it. Frameworks, drafts, and evidence strategies produced on this platform should be reviewed and refined by your attorney before submission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the fullest extent permitted by law, Pinnacle³, its owners, employees, coaches, and affiliates shall not be liable for any decisions made, actions taken, or outcomes resulting from the use of information or content provided through this platform. This includes any immigration denials, delays, or adverse outcomes related to petitions prepared with or informed by content from this platform.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <p className="text-muted-foreground text-sm">
              By using Pinnacle³, you acknowledge that you have read, understood, and agreed to this Disclaimer in full.
              See also our <a href="/terms" className="text-[#1E2D6B] underline hover:no-underline">Terms of Service</a> and{" "}
              <a href="/privacy-policy" className="text-[#1E2D6B] underline hover:no-underline">Privacy Policy</a>.
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
