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

type Phase = "polling" | "countdown" | "timeout";

export default function PaymentSuccess() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("polling");
  const [countdown, setCountdown] = useState(5);
  const tokenRef = useRef<string | null>(null);
  const productRef = useRef<string | null>(null);
  const requiresPasswordChangeRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setPhase("timeout");
      return;
    }

    let cancelled = false;
    let pollCount = 0;
    const MAX_POLLS = 14; // ~21 seconds at 1.5s intervals

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/auth/session-auto-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            tokenRef.current = data.token;
            productRef.current = data.product ?? null;
            requiresPasswordChangeRef.current = data.requiresPasswordChange ?? false;
            if (!cancelled) setPhase("countdown");
            return;
          }
        }
      } catch { /* ignore network hiccup, keep polling */ }

      pollCount++;
      if (pollCount >= MAX_POLLS) {
        if (!cancelled) setPhase("timeout");
        return;
      }
      setTimeout(poll, 1500);
    };

    poll();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      const dest = requiresPasswordChangeRef.current
        ? "/set-password"
        : getProductRoute(productRef.current);
      navigate(dest);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, navigate]);

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

            {phase === "polling" && (
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

            {phase === "countdown" && (
              <>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Your account is ready. Signing you in now.
                </p>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                      <circle
                        cx="32" cy="32" r="28"
                        fill="none" stroke="#1E2D6B" strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (countdown / 5)}`}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#1E2D6B]">
                      {countdown}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#1E2D6B]">Signing you in…</p>
                </div>
              </>
            )}

            {phase === "timeout" && (
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
