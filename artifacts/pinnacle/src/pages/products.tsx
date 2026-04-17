import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Target, Shield, Map } from "lucide-react";

export default function Products() {
  return (
    <PublicLayout>
      <div className="py-20 px-4 bg-gray-50 min-h-[calc(100vh-200px)]">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">The Ecosystem</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Three purpose-built products designed to take you from uncertain to extraordinary.</p>
          </div>

          <div className="space-y-12">
            {/* Excellence Lab */}
            <div className="bg-white rounded-2xl border border-border p-8 md:p-12 shadow-sm flex flex-col md:flex-row gap-8 items-center">
              <div className="w-20 h-20 rounded-xl bg-blue-50 text-[#1E2D6B] flex items-center justify-center shrink-0">
                <Target className="w-10 h-10" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-4">Excellence Lab</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Deep-dive technical courses on fulfilling specific USCIS criteria. Learn the exact methodologies used by successful candidates to secure media coverage, navigate peer review, and prove critical impact in your field.
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6 ml-4">
                  <li>Strategic Media Coverage Acquisition</li>
                  <li>Peer Review Network Development</li>
                  <li>Critical Capacity Role Substantiation</li>
                </ul>
                <Link href="/dashboard">
                  <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Access Lab</Button>
                </Link>
              </div>
            </div>

            {/* Evidence Vault */}
            <div className="bg-white rounded-2xl border border-border p-8 md:p-12 shadow-sm flex flex-col md:flex-row gap-8 items-center">
              <div className="w-20 h-20 rounded-xl bg-blue-50 text-[#1E2D6B] flex items-center justify-center shrink-0">
                <Shield className="w-10 h-10" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-4">Evidence Vault</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  A secure, organized repository for your professional artifacts, mapped directly to visa criteria. Stop using chaotic shared folders. Organize your case with clinical precision.
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6 ml-4">
                  <li>Criterion-mapped evidence tracking</li>
                  <li>Strength evaluation and gap analysis</li>
                  <li>Export-ready formatting for attorney review</li>
                </ul>
                <Link href="/dashboard">
                  <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Open Vault</Button>
                </Link>
              </div>
            </div>

            {/* Elite Blueprint */}
            <div className="bg-white rounded-2xl border border-[#1E2D6B]/30 p-8 md:p-12 shadow-md relative overflow-hidden flex flex-col md:flex-row gap-8 items-center">
              <div className="absolute top-0 right-0 bg-[#1E2D6B] text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
                Premium
              </div>
              <div className="w-20 h-20 rounded-xl bg-[#1E2D6B] text-white flex items-center justify-center shrink-0">
                <Map className="w-10 h-10" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-4">Elite Blueprint</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  1-on-1 strategic coaching, precise milestone tracking, and a bespoke filing strategy crafted for your unique profile by our senior advisors.
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6 ml-4">
                  <li>Bespoke filing strategy and timeline</li>
                  <li>Dedicated strategic advisor</li>
                  <li>Accountability milestones and progress tracking</li>
                </ul>
                <Link href="/dashboard">
                  <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Request Blueprint</Button>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
