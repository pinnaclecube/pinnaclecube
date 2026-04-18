import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/ui/logo";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { useAuth } from "@/contexts/AuthContext";
import { TestimonialsCarousel } from "@/components/ui/TestimonialsCarousel";

const DISCLAIMER_VERSION = "1.0";

export default function ClientRegister() {
  const { register } = useAuth();
  const [, navigate] = useLocation();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.first_name.trim()) { setError("First name is required."); return; }
    if (!form.last_name.trim()) { setError("Last name is required."); return; }
    if (!form.email.trim()) { setError("Email address is required."); return; }
    if (!form.password) { setError("Password is required."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (!check1 || !check2) { setError("You must accept both agreements to continue."); return; }

    setLoading(true);
    try {
      await register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        disclaimer_accepted: true,
        disclaimer_version: DISCLAIMER_VERSION,
      });
      navigate("/dashboard/readiness-intake");
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left panel */}
        <div className="hidden md:flex md:w-[40%] bg-[#1E2D6B] flex-col justify-between p-12 relative overflow-hidden shrink-0">
          <div className="absolute -right-20 -bottom-20 text-[350px] font-black text-white/[0.04] leading-none pointer-events-none select-none">³</div>
          <div className="relative z-10">
            <Logo href="/" variant="light" />
          </div>
          <div className="relative z-10 space-y-8">
            <div>
              <h2 className="text-2xl font-extrabold text-white leading-tight mb-2">
                Your career has already proven you're extraordinary.
              </h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Now let's make USCIS see it the same way.
              </p>
            </div>
            <TestimonialsCarousel variant="compact" intervalMs={8000} />
          </div>
          <p className="text-white/30 text-xs relative z-10">Advisory coaching service. Not a law firm.</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-start justify-center px-6 py-14 bg-slate-50">
          <div className="w-full max-w-lg">
            <div className="md:hidden mb-10">
              <Logo href="/" />
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-[#0A1128]">Create your account</h1>
              <p className="text-slate-500 mt-2">Your free readiness assessment is waiting on the other side.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name" className="text-slate-700 font-medium">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="mt-1.5 h-11 bg-white border-slate-200"
                    placeholder="Priya"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name" className="text-slate-700 font-medium">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="mt-1.5 h-11 bg-white border-slate-200"
                    placeholder="Mehta"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-slate-700 font-medium">
                  Email address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1.5 h-11 bg-white border-slate-200"
                  placeholder="priya@company.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-slate-700 font-medium">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="mt-1.5 h-11 bg-white border-slate-200"
                  placeholder="Minimum 8 characters"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div>
                <Label htmlFor="confirm" className="text-slate-700 font-medium">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  className="mt-1.5 h-11 bg-white border-slate-200"
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-white">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Required Agreements</h3>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="check1"
                    checked={check1}
                    onCheckedChange={(v) => setCheck1(!!v)}
                    className="mt-0.5"
                  />
                  <label htmlFor="check1" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                    I understand that Pinnacle³ is an advisory coaching service and{" "}
                    <strong className="text-slate-800">not a law firm</strong>. No information provided constitutes legal advice, and I will consult a licensed immigration attorney for legal guidance.
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="check2"
                    checked={check2}
                    onCheckedChange={(v) => setCheck2(!!v)}
                    className="mt-0.5"
                  />
                  <label htmlFor="check2" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                    I acknowledge that AI-generated content on this platform may contain errors and must be independently verified by a licensed attorney before use in any immigration filing.
                  </label>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !check1 || !check2}
                className="w-full bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white h-12 rounded font-bold text-base transition-colors disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{" "}
                <Link href="/login" className="text-[#1E2D6B] font-semibold hover:underline">
                  Sign in
                </Link>
              </p>

              <p className="text-center text-xs text-slate-400 leading-relaxed">
                By creating an account you agree to our{" "}
                <Link href="/terms" className="text-[#1E2D6B] hover:underline">Terms of Service</Link>
                {" "}and our{" "}
                <Link href="/disclaimer" className="text-[#1E2D6B] hover:underline">Disclaimer</Link>.
              </p>
            </form>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
