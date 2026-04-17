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
  { href: "/evidence", label: "Evidence Vault", icon: FolderLock },
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
    </aside>
  );
}
