import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StaffProtectedRouteProps {
  children: ReactNode;
}

export function StaffProtectedRoute({ children }: StaffProtectedRouteProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/staff/validate", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setAuthenticated(data.authenticated ?? false))
      .catch(() => setAuthenticated(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: input.trim() }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Invalid token");
        return;
      }

      setAuthenticated(true);
      setError("");
    } catch {
      setError("Login failed");
    }
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p>Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-[#1E2D6B]">Staff Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="staff-token">Staff Token</Label>
                <Input
                  id="staff-token"
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter staff token"
                  className="mt-1"
                />
                {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
              </div>
              <Button type="submit" className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                Access Staff Portal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
