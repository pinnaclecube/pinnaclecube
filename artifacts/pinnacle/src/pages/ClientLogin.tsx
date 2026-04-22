import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { ReconsentModal } from "@/components/disclaimers/ReconsentModal";
import { useAuth } from "@/contexts/AuthContext";
import { useDisclaimer } from "@/contexts/DisclaimerContext";
import { TestimonialsCarousel } from "@/components/ui/TestimonialsCarousel";

export default function ClientLogin() {
  const { login } = useAuth();
  const { setRequiresReconsent } = useDisclaimer();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      if (result.requiresReconsent) {
        setRequiresReconsent(true);
      } else if (result.accessLevel === "free") {
        navigate("/choose-plan");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
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
          <div className="relative z-10 space-y-8">
            <TestimonialsCarousel variant="compact" intervalMs={7000} />
            <div className="grid grid-cols-2 gap-5 pt-2">
              <div>
                <div className="text-3xl font-extrabold text-[#F59E0B]">94%</div>
                <div className="text-white/50 text-sm mt-1">Client approval rate</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-[#F59E0B]">11 days</div>
                <div className="text-white/50 text-sm mt-1">Fastest approval achieved</div>
              </div>
            </div>
          </div>
          <p className="text-white/30 text-xs relative z-10">Not a law firm. Advisory coaching service.</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-16 bg-slate-50 min-h-screen md:min-h-0">
          <div className="w-full max-w-md">
            <div className="md:hidden mb-10">
              <Logo href="/" />
            </div>

            <div className="mb-10">
              <h1 className="text-3xl font-extrabold text-[#0A1128]">Welcome back</h1>
              <p className="text-slate-500 mt-2">Sign in to continue building your case.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1.5 h-12 bg-white border-slate-200 focus:border-[#1E2D6B] focus:ring-[#1E2D6B]"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="mt-1.5 h-12 bg-white border-slate-200 focus:border-[#1E2D6B] focus:ring-[#1E2D6B]"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white h-12 rounded font-bold text-base transition-colors disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>

              <p className="text-center text-sm text-slate-500">
                Don't have an account?{" "}
                <Link href="/register" className="text-[#1E2D6B] font-semibold hover:underline">
                  Create one
                </Link>
              </p>
            </form>

            <p className="text-center text-xs text-slate-400 mt-10 leading-relaxed">
              Pinnacle³ is an advisory coaching service, not a law firm.
              Nothing on this platform constitutes legal advice.
            </p>
          </div>
        </div>
      </div>

      <PublicFooter />
      <ReconsentModal />
    </div>
  );
}
