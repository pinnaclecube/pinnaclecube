import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ClipboardList, Shield } from "lucide-react";

export default function EvidenceVaultSuccess() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Access Activated!</h1>
          <p className="text-muted-foreground mb-2 leading-relaxed">
            Your Evidence Engine is ready. Your Google Drive folders are being set up — you'll receive an email when they're available.
          </p>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            First, complete your <strong>Readiness Intake</strong> so we can personalize your evidence strategy and identify any gaps.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard/readiness-intake">
              <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                <ClipboardList className="w-4 h-4 mr-2" /> Complete Readiness Intake
              </Button>
            </Link>
            <Link href="/evidence">
              <Button variant="outline">
                <Shield className="w-4 h-4 mr-2" /> Open Evidence Engine
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
