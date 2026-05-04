import { useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

type State = "idle" | "loading" | "sent" | "not_found" | "error";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.status === 404) {
        setState("not_found");
      } else if (res.ok) {
        setState("sent");
      } else {
        setState("error");
        console.error(data.error);
      }
    } catch {
      setState("error");
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
          <div className="relative z-10">
            <p className="text-white/70 text-lg leading-relaxed">
              "The strategic clarity we provide extends to every step of the process — including regaining access to your account."
            </p>
          </div>
          <p className="text-white/30 text-xs relative z-10">Not a law firm. Advisory coaching service.</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-16 bg-slate-50 min-h-screen md:min-h-0">
          <div className="w-full max-w-md">
            <div className="md:hidden mb-10">
              <Logo href="/" />
            </div>

            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>

            {state === "sent" ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-extrabold text-[#0A1128] mb-3">Check your inbox</h1>
                <p className="text-slate-500 leading-relaxed mb-6">
                  We sent a password reset link to <strong>{email}</strong>. It's valid for 1 hour.
                </p>
                <p className="text-sm text-slate-400">
                  Didn't get it? Check your spam folder, or{" "}
                  <button
                    onClick={() => setState("idle")}
                    className="text-[#1E2D6B] font-semibold hover:underline"
                  >
                    try again
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-xl bg-[#1E2D6B]/10 flex items-center justify-center mb-5">
                    <Mail className="w-6 h-6 text-[#1E2D6B]" />
                  </div>
                  <h1 className="text-3xl font-extrabold text-[#0A1128]">Forgot password?</h1>
                  <p className="text-slate-500 mt-2">Enter your email and we'll send you a reset link.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (state !== "idle") setState("idle"); }}
                      className="mt-1.5 h-12 bg-white border-slate-200 focus:border-[#1E2D6B] focus:ring-[#1E2D6B]"
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  {state === "not_found" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      No account found with that email.{" "}
                      <Link href="/register" className="font-semibold underline">Register instead?</Link>
                    </div>
                  )}

                  {state === "error" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                      Something went wrong. Please try again.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={state === "loading"}
                    className="w-full bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white h-12 rounded font-bold text-base transition-colors disabled:opacity-60"
                  >
                    {state === "loading" ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              </>
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
