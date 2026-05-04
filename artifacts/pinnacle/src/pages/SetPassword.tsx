import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/contexts/AuthContext";
import { KeyRound, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";

const TOKEN_KEY = "pinnacle_token";

function getDashboardForAccessLevel(accessLevel: string): string {
  if (accessLevel === "evidence_vault") return "/evidence";
  if (accessLevel === "elite_blueprint") return "/blueprint";
  return "/dashboard";
}

export default function SetPassword() {
  const { user, isLoading, updateUser } = useAuth();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [isLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to set password. Please try again.");
        return;
      }

      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      if (data.user) {
        updateUser(data.user);
      }

      setDone(true);
      setTimeout(() => {
        navigate(getDashboardForAccessLevel(data.user?.accessLevel ?? user?.accessLevel ?? ""));
      }, 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-[#1E2D6B]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-10 flex flex-col items-center text-center">
            <Logo href="/" className="mb-8" />
            <div className="w-14 h-14 rounded-full bg-[#1E2D6B]/10 flex items-center justify-center mb-5">
              <KeyRound className="w-7 h-7 text-[#1E2D6B]" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#0A1128]">Set your password</h1>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">
              {user?.firstName ? `Welcome, ${user.firstName}!` : "Welcome!"} Choose a secure password to protect your account.
            </p>
          </div>

          {done ? (
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="font-semibold text-green-800 text-lg">Password set successfully!</p>
              <p className="text-slate-500 text-sm">Taking you to your dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <div>
                <Label htmlFor="password" className="text-slate-700 font-medium">New password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-white border-slate-200 focus:border-[#1E2D6B] focus:ring-[#1E2D6B] pr-10"
                    placeholder="At least 8 characters"
                    required
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm" className="text-slate-700 font-medium">Confirm password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-12 bg-white border-slate-200 focus:border-[#1E2D6B] focus:ring-[#1E2D6B] pr-10"
                    placeholder="Re-enter your password"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {password && confirm && password !== confirm && (
                <p className="text-xs text-red-600">Passwords do not match.</p>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !password || !confirm}
                className="w-full bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white h-12 rounded font-bold text-base transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Setting password…</>
                  : "Set Password & Continue"
                }
              </button>
            </form>
          )}

          <p className="text-center text-xs text-slate-400 mt-8 leading-relaxed">
            Pinnacle³ is an advisory coaching service, not a law firm.
          </p>
        </div>
      </div>
    </div>
  );
}
