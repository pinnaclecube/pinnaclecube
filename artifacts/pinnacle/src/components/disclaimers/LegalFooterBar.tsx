import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LEGAL_DISCLAIMER } from "@/lib/disclaimers";

export function LegalFooterBar() {
  const [expanded, setExpanded] = useState(false);
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap shrink-0">
          © {year} Pinnacle³ — Not a law firm. Not legal advice.
        </span>

        <div className="flex-1 min-w-0">
          <div className="hidden sm:block text-xs text-muted-foreground leading-relaxed">
            {LEGAL_DISCLAIMER}
          </div>
          <div className="sm:hidden">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
              aria-expanded={expanded}
            >
              {expanded ? "Hide disclaimer" : "Show full disclaimer"}
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {expanded && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {LEGAL_DISCLAIMER}
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
