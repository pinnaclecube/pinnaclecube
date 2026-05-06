import { useEffect } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ClipboardList, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function EvidenceVaultSuccess() {
  const { refreshUser } = useAuth();

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

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
            Your Evidence Engine is ready. Your Google Drive root folders are being created now in the background.
          </p>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Once you complete your <strong>Readiness Intake</strong> and select a visa path, your per-criterion evidence folders will be set up automatically and will appear in the <strong>Drive Files</strong> tab — no manual setup required.
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
