import { useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { LegalFooterBar } from "@/components/disclaimers/LegalFooterBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Lock, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const INCLUDES = [
  "Evidence organized by all 10 EB-1A criteria",
  "AI-powered gap analysis & readiness scores",
  "Exhibit labels & cover page generation",
  "Secure Google Drive integration",
  "Full Excellence Lab access included",
  "Lifetime access — no subscription",
];

export default function EvidenceVaultCheckout() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: "evidence_vault",
          success_url: `${window.location.origin}/evidence-vault/success`,
          cancel_url: `${window.location.origin}/evidence-vault/cancel`,
          customer_email: user?.email,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-[#1E2D6B]/10 text-[#1E2D6B] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              <Shield className="w-3.5 h-3.5" />
              Evidence Vault
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Complete Your Purchase</h1>
            <p className="text-muted-foreground">One-time payment · Includes Excellence Lab</p>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
                <div>
                  <h2 className="font-bold text-foreground text-xl">Evidence Vault</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">Professional evidence management + Excellence Lab</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#1E2D6B]">$497</div>
                  <div className="text-xs text-muted-foreground">one-time</div>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">What's included</h3>
                {INCLUDES.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {!user ? (
                <div className="space-y-3">
                  <Link href="/register?redirect=/evidence-vault/checkout">
                    <Button className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base">
                      Create Account & Purchase
                    </Button>
                  </Link>
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login?redirect=/evidence-vault/checkout" className="text-[#1E2D6B] font-medium hover:underline">
                      Sign in
                    </Link>
                  </p>
                </div>
              ) : (
                <Button onClick={handleCheckout} disabled={loading} className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base">
                  <Lock className="w-4 h-4 mr-2" />
                  {loading ? "Redirecting..." : "Pay $497 Securely"}
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground mt-4">Secured by Stripe · 256-bit encryption</p>
            </CardContent>
          </Card>
        </div>
      </main>
      <LegalFooterBar />
    </div>
  );
}
