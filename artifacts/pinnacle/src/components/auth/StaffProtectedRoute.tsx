import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STAFF_TOKEN_KEY = "pinnacle_staff_token";

interface StaffProtectedRouteProps {
  children: ReactNode;
}

export function StaffProtectedRoute({ children }: StaffProtectedRouteProps) {
  const [stored, setStored] = useState(() => sessionStorage.getItem(STAFF_TOKEN_KEY));
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sessionStorage.setItem(STAFF_TOKEN_KEY, input.trim());
    setStored(input.trim());
    setError("");
  };

  if (!stored) {
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

export function getStaffToken(): string | null {
  return sessionStorage.getItem(STAFF_TOKEN_KEY);
}
