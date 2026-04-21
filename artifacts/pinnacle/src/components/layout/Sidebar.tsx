import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Target, 
  FolderLock, 
  FileCheck2, 
  Map, 
  GraduationCap 
} from "lucide-react";
import { Logo } from "../ui/logo";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/where-you-stand", label: "Where You Stand", icon: Target },
  { href: "/evidence", label: "Evidence Engine", icon: FolderLock },
  { href: "/criteria", label: "Criteria Exhibit", icon: FileCheck2 },
  { href: "/blueprint", label: "Elite Blueprint", icon: Map },
  { href: "/courses", label: "Excellence Lab", icon: GraduationCap },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 border-r border-border bg-gray-50 flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-border bg-white">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? "bg-[#1E2D6B] text-white shadow-sm" 
                  : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-muted-foreground"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="px-5 py-4 border-t border-border">
        <a
          href="https://www.linkedin.com/company/pinnaclecube/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Pinnacle³ on LinkedIn"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-[#0A66C2] transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Follow us on LinkedIn
        </a>
      </div>
    </aside>
  );
}
