import { PublicLayout } from "@/components/layout/PublicLayout";
import { CheckCircle2 } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      title: "Initial Readiness Assessment",
      description: "We evaluate your background, citations, publications, and professional impact against strict USCIS criteria to determine your viability for EB-1A, EB-2 NIW, or O-1A.",
    },
    {
      title: "Evidence Vault Construction",
      description: "You begin uploading your artifacts into our secure Evidence Vault. Our system categorizes them by criterion, identifying gaps and strengths in your profile.",
    },
    {
      title: "Elite Blueprint Strategy",
      description: "We develop a bespoke, milestone-driven Elite Blueprint. This strategic roadmap details exactly what additional evidence you need to acquire and by when.",
    },
    {
      title: "Excellence Lab Execution",
      description: "For areas needing reinforcement, you engage with our Excellence Lab courses—learning exactly how to secure targeted media coverage, high-impact peer review opportunities, or critical advisory roles.",
    },
    {
      title: "Final Review & Attorney Handoff",
      description: "Once your profile reaches our 'Ready to File' threshold, your Evidence Vault is finalized. You are now prepared to engage an immigration attorney with a fully substantiated, undeniable case.",
    }
  ];

  return (
    <PublicLayout>
      <div className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">The Pinnacle³ Process</h1>
            <p className="text-xl text-muted-foreground">A deterministic approach to building an undeniable immigration case.</p>
          </div>

          <div className="space-y-12">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#1E2D6B] text-white flex items-center justify-center font-bold text-xl">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3 text-foreground">{step.title}</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
