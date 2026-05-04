import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CheckCircle, Loader2, ShieldAlert } from "lucide-react";

type Phase = "loading" | "valid" | "invalid" | "submitting" | "success" | "error";

const TOKEN_KEY = "pinnacle_token";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState("");

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  // Validate the token on mount
  useEffect(() => {
    if (!token) { setPhase("invalid"); return; }
    fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then((r) => { setPhase(r.ok ? "valid" : "invalid"); })
      .catch(() => setPhase("invalid"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    setServerError("");

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setValidationError("Passwords do not match.");
      return;
    }

    setPhase("submitting");
    try {
      const res = await fetch("/api/auth/reset-password-by-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setPhase("success");
        setTimeout(() => navigate("/dashboard"), 2500);
      } else {
        setServerError(data.error ?? "Reset failed. The link may have expired.");
        setPhase("error");
      }
    } catch {
      setServerError("Something went wrong. Please try again.");
      setPhase("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left panel */}
        <div className="hidden md:flex md:w-[45%] bg-[#1E2D6B] flex-col justify-between p-12 relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 text-[350px] font-black text-white/[0.04] leading-none pointer-events-none select-none">³</div>
          <div className="relative z-10">
            <Logo href="/" variant="light" />
          </div>
          <p className="text-white/30 text-xs relative z-10">Not a law firm. Advisory coaching service.</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-16 bg-slate-50 min-h-screen md:min-h-0">
          <div className="w-full max-w-md">
            <div className="md:hidden mb-10">
              <Logo href="/" />
            </div>

            {phase === "loading" && (
              <div className="flex flex-col items-center gap-4 py-16">
                <Loader2 className="w-8 h-8 text-[#1E2D6B] animate-spin" />
                <p className="text-slate-500 text-sm">Validating your reset link…</p>
              </div>
            )}

            {phase === "invalid" && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                  </div>
                </div>
                <h1 className="text-2xl font-extrabold text-[#0A1128] mb-3">Link expired or invalid</h1>
                <p className="text-slate-500 leading-relaxed mb-6">
                  This password reset link has expired or already been used. Reset links are valid for 1 hour.
                </p>
                <Link href="/forgot-password">
                  <button className="w-full bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white h-12 rounded font-bold text-base transition-colors">
                    Request a new reset link
                  </button>
                </Link>
              </div>
            )}

            {(phase === "valid" || phase === "submitting" || phase === "error") && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-extrabold text-[#0A1128]">Set new password</h1>
                  <p className="text-slate-500 mt-2">Choose a strong password for your account.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label htmlFor="password" className="text-slate-700 font-medium">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5 h-12 bg-white border-slate-200 focus:border-[#1E2D6B] focus:ring-[#1E2D6B]"
                      placeholder="At least 8 characters"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirm" className="text-slate-700 font-medium">Confirm password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="mt-1.5 h-12 bg-white border-slate-200 focus:border-[#1E2D6B] focus:ring-[#1E2D6B]"
                      placeholder="Repeat your new password"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  {validationError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                      {validationError}
                    </div>
                  )}
                  {serverError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                      {serverError}{" "}
                      <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={phase === "submitting"}
                    className="w-full bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white h-12 rounded font-bold text-base transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {phase === "submitting" && <Loader2 className="w-4 h-4 animate-spin" />}
                    {phase === "submitting" ? "Saving…" : "Set new password"}
                  </button>
                </form>
              </>
            )}

            {phase === "success" && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-extrabold text-[#0A1128] mb-3">Password updated!</h1>
                <p className="text-slate-500 leading-relaxed">
                  You're being signed in automatically…
                </p>
              </div>
            )}

            <p className="text-center text-xs text-slate-400 mt-10 leading-relaxed">
              Pinnacle³ is an advisory coaching service, not a law firm.
              Nothing on this platform constitutes legal advice.
            </p>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
