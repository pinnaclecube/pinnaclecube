import { ShieldAlert } from "lucide-react";
import { LEGAL_DISCLAIMER, AI_VARIANTS } from "@/lib/disclaimers";

interface DocumentDisclaimerProps {
  docType?: "cover_letter" | "criteria_exhibit" | "reco_letter" | "exhibit_index" | "general";
}

const DOC_TYPE_LABEL: Record<NonNullable<DocumentDisclaimerProps["docType"]>, string> = {
  cover_letter: "Cover Letter",
  criteria_exhibit: "Criteria Exhibit",
  reco_letter: "Recommendation Letter",
  exhibit_index: "Exhibit Index",
  general: "Document",
};

export function DocumentDisclaimer({ docType = "general" }: DocumentDisclaimerProps) {
  const isCoverLetter = docType === "cover_letter";

  return (
    <div className="w-full space-y-2 mb-6" role="note" aria-label="Document disclaimer">
      <div className="border border-red-200 bg-red-50 rounded-md px-4 py-3 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <div className="text-sm text-red-900 leading-relaxed">
          <p className="font-semibold mb-0.5">
            {isCoverLetter
              ? "IMPORTANT — Cover letters must be reviewed by your attorney before submission."
              : `${DOC_TYPE_LABEL[docType]} — Attorney review required before any use.`}
          </p>
          <p>{LEGAL_DISCLAIMER}</p>
        </div>
      </div>

      <div className="border-l-4 border-purple-500 bg-purple-50 rounded-r-md px-4 py-3 flex items-start gap-3">
        <div className="text-sm text-purple-900 leading-relaxed">
          <span className="font-semibold">AI-generated draft. </span>
          {AI_VARIANTS.document}
        </div>
      </div>
    </div>
  );
}
