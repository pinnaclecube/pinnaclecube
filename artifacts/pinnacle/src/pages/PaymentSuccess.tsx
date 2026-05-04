import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";

const TOKEN_KEY = "pinnacle_token";

const PRODUCT_ROUTES: Record<string, string> = {
  evidence_vault: "/evidence",
  elite_blueprint: "/blueprint",
  excellence_lab: "/dashboard",
};

function getProductRoute(product: string | null): string {
  if (!product) return "/dashboard";
  return PRODUCT_ROUTES[product] ?? "/dashboard";
}

type Phase = "loading" | "ready" | "error";

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("loading");
  const destinationRef = useRef<string>("/set-password");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setPhase("error");
      return;
    }

    fetch("/api/auth/payment-provision-and-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.token) throw new Error(data.error ?? "No token");
        localStorage.setItem(TOKEN_KEY, data.token);
        destinationRef.current = data.requiresPasswordChange
          ? "/set-password"
          : getProductRoute(data.product ?? null);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;
    const t = setTimeout(() => navigate(destinationRef.current), 1200);
    return () => clearTimeout(t);
  }, [phase, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg text-center">
          <div className="mb-8 flex justify-center">
            <Logo href="/" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
            <div className="flex justify-center mb-6">
              <div className="w-18 h-18 rounded-full bg-green-100 flex items-center justify-center p-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <h1 className="text-2xl font-extrabold text-[#0A1128] mb-3">
              Payment confirmed!
            </h1>

            {phase === "loading" && (
              <>
                <p className="text-slate-600 leading-relaxed mb-8">
                  Setting up your account — this only takes a moment.
                </p>
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-8 h-8 text-[#1E2D6B] animate-spin" />
                  <p className="text-sm text-slate-500">Activating your access…</p>
                </div>
              </>
            )}

            {phase === "ready" && (
              <>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Your account is ready. Signing you in now.
                </p>
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-7 h-7 text-[#1E2D6B] animate-spin" />
                  <p className="text-sm font-medium text-[#1E2D6B]">Taking you to your dashboard…</p>
                </div>
              </>
            )}

            {phase === "error" && (
              <>
                <p className="text-slate-600 leading-relaxed mb-8">
                  Your payment was received. Check your email for your login credentials, then sign in below.
                </p>
                <a href="/login">
                  <button className="w-full bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white h-12 rounded-lg font-bold text-base transition-colors flex items-center justify-center gap-2">
                    Go to Sign In <ArrowRight className="w-4 h-4" />
                  </button>
                </a>
                <p className="text-xs text-slate-400 mt-6 leading-relaxed">
                  Didn't receive an email within a few minutes? Check your spam folder or{" "}
                  <a href="mailto:support@pinnaclecube.com" className="text-[#1E2D6B] hover:underline">
                    contact support
                  </a>.
                </p>
              </>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-8 leading-relaxed">
            Pinnacle³ is an advisory coaching service, not a law firm. Nothing on this platform constitutes legal advice.
          </p>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
