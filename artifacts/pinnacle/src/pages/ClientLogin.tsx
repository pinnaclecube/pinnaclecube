import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { LegalFooterBar } from "@/components/disclaimers/LegalFooterBar";
import { ReconsentModal } from "@/components/disclaimers/ReconsentModal";
import { useAuth } from "@/contexts/AuthContext";
import { useDisclaimer } from "@/contexts/DisclaimerContext";

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="py-6 px-8">
        <Logo href="/" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground mt-2">Sign in to your Pinnacle³ account</p>
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="mt-1"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-11 text-base"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Link href="/register" className="text-[#1E2D6B] font-medium hover:underline">
                    Create one
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-8 leading-relaxed px-4">
            Pinnacle³ is an advisory coaching service, not a law firm. Nothing on this platform constitutes legal advice.
          </p>
        </div>
      </main>

      <LegalFooterBar />
      <ReconsentModal />
    </div>
  );
}
