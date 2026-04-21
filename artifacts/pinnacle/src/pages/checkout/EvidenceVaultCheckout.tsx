import { useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Lock, Shield, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const INCLUDES = [
  "Evidence organized by all 10 EB-1A criteria",
  "AI-powered gap analysis & readiness scores",
  "Exhibit labels & cover page generation",
  "Secure Google Drive integration",
  "Full Excellence Lab access included",
  "Cancel anytime — no long-term commitment",
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
              Evidence Engine
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Complete Your Purchase</h1>
            <p className="text-muted-foreground">Monthly subscription · Cancel anytime</p>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
                <div>
                  <h2 className="font-bold text-foreground text-xl">Evidence Engine</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">Professional evidence management + Excellence Lab</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#1E2D6B]">$49</div>
                  <div className="text-xs text-muted-foreground">per month</div>
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

              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-6">
                <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">
                  Billed monthly at $49. Cancel anytime from your Stripe billing portal — no penalties.
                </p>
              </div>

              {!user ? (
                <div className="space-y-3">
                  <Link href="/register?redirect=/evidence-vault/checkout">
                    <Button className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base">
                      Create Account & Subscribe
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
                  {loading ? "Redirecting..." : "Subscribe — $49/mo"}
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground mt-4">Secured by Stripe · 256-bit encryption</p>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground px-4">
            Pinnacle³ is an advisory coaching service, not a law firm. Subscription grants access to the Evidence Engine platform.
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
