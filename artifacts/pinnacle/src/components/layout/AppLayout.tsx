import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { LegalFooter } from "../shared/LegalFooter";
import { Navbar } from "./Navbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex bg-white">
      <div className="hidden md:block fixed inset-y-0 left-0 w-64 z-40">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <Navbar />
        <main className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
          {children}
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
