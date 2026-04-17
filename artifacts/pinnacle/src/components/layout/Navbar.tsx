import { Link, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ClientProfileDialog } from "@/components/auth/ClientProfileDialog";
import { ChevronDown, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PUBLIC_PATHS = ["/", "/how-it-works", "/products", "/excellence-lab", "/evidence-vault", "/elite-blueprint", "/quiz", "/login", "/register", "/instant-profile-insight/start", "/instant-profile-insight/results"];

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const isPublic = PUBLIC_PATHS.includes(location) || location.startsWith("/elite-blueprint/") || location.startsWith("/excellence-lab/") || location.startsWith("/evidence-vault/");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Logo href={user ? "/dashboard" : "/"} />

        <nav className="hidden md:flex items-center gap-6">
          {!user ? (
            isPublic ? (
              <>
                <Link href="/excellence-lab" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Excellence Lab</Link>
                <Link href="/evidence-vault" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Evidence Vault</Link>
                <Link href="/elite-blueprint" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Elite Blueprint</Link>
                <div className="h-4 w-px bg-border mx-2" />
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Get Started</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Get Started</Button>
                </Link>
              </>
            )
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

      <ClientProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
}
