import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/ui/logo";
import { LegalFooterBar } from "@/components/disclaimers/LegalFooterBar";
import { useAuth } from "@/contexts/AuthContext";

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

    if (!form.first_name.trim()) {
      setError("First name is required.");
      return;
    }
    if (!form.last_name.trim()) {
      setError("Last name is required.");
      return;
    }
    if (!form.email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!form.password) {
      setError("Password is required.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!form.confirmPassword) {
      setError("Please confirm your password.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!check1 || !check2) {
      setError("You must accept both disclaimer checkboxes to continue.");
      return;
    }

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="py-6 px-8">
        <Logo href="/" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Create your account</h1>
            <p className="text-muted-foreground mt-2">Start your path to extraordinary status</p>
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="first_name"
                      value={form.first_name}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      className="mt-1"
                      placeholder="Priya"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="last_name"
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      className="mt-1"
                      placeholder="Mehta"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email address <span className="text-red-500">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1"
                    placeholder="priya@company.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="mt-1"
                    placeholder="Minimum 8 characters"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <Label htmlFor="confirm">Confirm Password <span className="text-red-500">*</span></Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    className="mt-1"
                    placeholder="Repeat your password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="border border-border rounded-lg p-4 space-y-4 bg-gray-50/50">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Required Agreements</h3>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="check1"
                      checked={check1}
                      onCheckedChange={(v) => setCheck1(!!v)}
                      className="mt-0.5"
                    />
                    <label htmlFor="check1" className="text-sm text-foreground leading-relaxed cursor-pointer">
                      I understand that Pinnacle³ is an advisory coaching service and <strong>not a law firm</strong>. No information provided constitutes legal advice, and I will consult a licensed immigration attorney for legal guidance.
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="check2"
                      checked={check2}
                      onCheckedChange={(v) => setCheck2(!!v)}
                      className="mt-0.5"
                    />
                    <label htmlFor="check2" className="text-sm text-foreground leading-relaxed cursor-pointer">
                      I acknowledge that AI-generated content on this platform may contain errors, is not a substitute for professional legal advice, and must be independently verified by a licensed attorney before use in any immigration filing.
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !check1 || !check2}
                  className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-11 text-base"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#1E2D6B] font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <LegalFooterBar />
    </div>
  );
}
