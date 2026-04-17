import { Link, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [location] = useLocation();
  const isApp = location !== "/" && location !== "/how-it-works" && location !== "/products";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        
        <nav className="hidden md:flex items-center gap-6">
          {!isApp ? (
            <>
              <Link href="/products" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Products</Link>
              <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it Works</Link>
              <div className="h-4 w-px bg-border mx-2" />
              <Link href="/dashboard" className="text-sm font-medium">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/dashboard" className="text-sm font-medium">
                <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Start Journey</Button>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-4">
               <Link href="/profile" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Profile</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
