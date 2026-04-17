import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { LegalFooterBar } from "../disclaimers/LegalFooterBar";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <LegalFooterBar />
    </div>
  );
}
