import { Link, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ClientProfileDialog } from "@/components/auth/ClientProfileDialog";
import { ChevronDown, LogOut, User, Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PUBLIC_PATHS = [
  "/", "/how-it-works", "/products",
  "/excellence-lab", "/evidence-vault", "/elite-blueprint",
  "/quiz", "/login", "/register", "/resources",
  "/instant-profile-insight/start", "/instant-profile-insight/results",
];

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPublicPath = PUBLIC_PATHS.includes(location)
    || location.startsWith("/elite-blueprint/")
    || location.startsWith("/excellence-lab/")
    || location.startsWith("/evidence-vault/")
    || location.startsWith("/resources/");

  const isPublicAnon = isPublicPath && !user;

  if (isPublicAnon) {
    return (
      <>
        <header className="fixed top-0 w-full z-50 bg-[#1E2D6B]/95 backdrop-blur-md border-b border-white/10">
          <div className="max-w-[1100px] mx-auto px-6 h-20 flex items-center justify-between">
            <Logo href="/" variant="light" />

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link href="/excellence-lab" className="text-white/80 hover:text-white transition-colors">
                Excellence Lab
              </Link>
              <Link href="/evidence-vault" className="text-white/80 hover:text-white transition-colors">
                Evidence Vault
              </Link>
              <Link href="/elite-blueprint" className="text-white/80 hover:text-white transition-colors">
                Elite Blueprint
              </Link>
              <Link href="/how-it-works" className="text-white/80 hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="/resources" className="text-white/80 hover:text-white transition-colors">
                Resources
              </Link>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <Link href="/login">
                <span className="text-white/80 hover:text-white text-sm font-medium transition-colors cursor-pointer">
                  Log in
                </span>
              </Link>
              <Link href="/dashboard">
                <button className="bg-white text-[#1E2D6B] px-6 py-2.5 rounded font-bold text-sm hover:bg-gray-100 transition-colors">
                  Get Started
                </button>
              </Link>
            </div>

            <button
              className="md:hidden text-white p-1"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden bg-[#0F1F4A] border-t border-white/10 px-6 py-6 space-y-1">
              <Link href="/excellence-lab" className="block text-white/80 hover:text-white text-sm font-medium py-3 border-b border-white/5">
                Excellence Lab
              </Link>
              <Link href="/evidence-vault" className="block text-white/80 hover:text-white text-sm font-medium py-3 border-b border-white/5">
                Evidence Vault
              </Link>
              <Link href="/elite-blueprint" className="block text-white/80 hover:text-white text-sm font-medium py-3 border-b border-white/5">
                Elite Blueprint
              </Link>
              <Link href="/how-it-works" className="block text-white/80 hover:text-white text-sm font-medium py-3 border-b border-white/5">
                How It Works
              </Link>
              <Link href="/resources" className="block text-white/80 hover:text-white text-sm font-medium py-3 border-b border-white/5">
                Resources
              </Link>
              <div className="pt-4 flex flex-col gap-3">
                <Link href="/login">
                  <span className="block text-white/80 hover:text-white text-sm font-medium py-2 cursor-pointer">
                    Log in
                  </span>
                </Link>
                <Link href="/dashboard">
                  <button className="w-full bg-white text-[#1E2D6B] px-6 py-3 rounded font-bold text-sm hover:bg-gray-100 transition-colors">
                    Get Started
                  </button>
                </Link>
              </div>
            </div>
          )}
        </header>
        <ClientProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo href={user ? "/dashboard" : "/"} />

          <nav className="hidden md:flex items-center gap-6">
            {!user ? (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Get Started</Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/where-you-stand">
                  <Button variant="outline" size="sm" className="border-[#1E2D6B]/30 text-[#1E2D6B] hover:bg-[#1E2D6B]/5">
                    Where You Stand
                  </Button>
                </Link>
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1.5 font-medium">
                      Hi, {user.firstName ?? user.name?.split(" ")[0] ?? "there"}
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                      <User className="w-4 h-4 mr-2" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </nav>

          <div className="md:hidden flex items-center gap-2">
            {user ? (
              <>
                <NotificationBell />
                <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      <ClientProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
