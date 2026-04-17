import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const TOKEN_KEY = "pinnacle_token";

export interface ClientUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  visaTarget: string;
  accessLevel: string;
  disclaimerAccepted: boolean;
  disclaimerVersion: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  linkedinUrl?: string | null;
  bio?: string | null;
  profession?: string | null;
  currentStatus?: string | null;
}

interface AuthContextValue {
  user: ClientUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ requiresReconsent?: boolean }>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  updateUser: (updates: Partial<ClientUser>) => void;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  disclaimer_accepted: true;
  disclaimer_version: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
  }, []);

  const fetchMe = useCallback(async (tok: string): Promise<ClientUser | null> => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user as ClientUser;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setToken(stored);
    fetchMe(stored).then((u) => {
      setUser(u);
      if (!u) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      setIsLoading(false);
    });
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed");

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user as ClientUser);
    return { requiresReconsent: data.requiresReconsent ?? false };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    navigate("/login");
  }, [navigate]);

  const register = useCallback(async (data: RegisterData) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Registration failed");

    localStorage.setItem(TOKEN_KEY, json.token);
    setToken(json.token);
    setUser(json.user as ClientUser);
  }, []);

  const updateUser = useCallback((updates: Partial<ClientUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const refreshUser = useCallback(async () => {
    const tok = localStorage.getItem(TOKEN_KEY);
    if (!tok) return;
    const u = await fetchMe(tok);
    if (u) setUser(u);
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, register, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
