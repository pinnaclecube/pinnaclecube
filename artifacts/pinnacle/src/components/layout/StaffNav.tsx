import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/internal/cases", label: "Cases" },
  { href: "/internal/prospects", label: "Prospects" },
  { href: "/internal/elite-blueprint-applications", label: "Blueprint Apps" },
  { href: "/internal/booth-events", label: "Booth Events" },
];

export default function StaffNav() {
  const [location] = useLocation();

  return (
    <header className="bg-[#1E2D6B] text-white px-8 py-3 flex items-center justify-between shrink-0">
      <Link href="/internal/cases" className="font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
        [pinnacle]³ <span className="text-white/50 font-normal text-sm ml-2">Staff Portal</span>
      </Link>
      <nav className="flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-1.5 rounded text-sm transition-colors",
              location.startsWith(link.href)
                ? "bg-white/20 text-white font-medium"
                : "text-white/70 hover:text-white hover:bg-white/10",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
