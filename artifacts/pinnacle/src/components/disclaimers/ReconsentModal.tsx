import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LEGAL_DISCLAIMER, AI_VARIANTS } from "@/lib/disclaimers";
import { useDisclaimer } from "@/contexts/DisclaimerContext";
import { useToast } from "@/hooks/use-toast";

export function ReconsentModal() {
  const { requiresReconsent, setRequiresReconsent } = useDisclaimer();
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!requiresReconsent) return null;

  const canSubmit = check1 && check2 && !loading;

  const handleAccept = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-disclaimer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "1.0", accepted: true }),
      });
      if (!res.ok) throw new Error("Failed to save acceptance");
      setRequiresReconsent(false);
    } catch {
      toast({
        title: "Error saving acceptance",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconsent-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#1E2D6B]/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#1E2D6B]" />
          </div>
          <div>
            <h2 id="reconsent-title" className="text-lg font-bold text-foreground">
              Updated Terms & Disclaimer
            </h2>
            <p className="text-sm text-muted-foreground">
              Our terms have been updated. Please review and re-accept to continue.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 border border-border rounded-md p-4 mb-6 text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>{LEGAL_DISCLAIMER}</p>
          <p>{AI_VARIANTS.analysis}</p>
        </div>

        <div className="space-y-4 mb-8">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              id="reconsent-check1"
              checked={check1}
              onCheckedChange={(v) => setCheck1(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed">
              I understand that Pinnacle³ is <strong>not a law firm</strong> and does not
              provide legal advice. All content is for informational purposes only, and I
              will consult a licensed immigration attorney before taking any legal action.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              id="reconsent-check2"
              checked={check2}
              onCheckedChange={(v) => setCheck2(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed">
              I understand that AI-generated content, analyses, and documents may contain
              errors and do <strong>not</strong> constitute legal advice or guarantee
              petition outcomes.
            </span>
          </label>
        </div>

        <Button
          onClick={handleAccept}
          disabled={!canSubmit}
          className="w-full bg-[#1E2D6B] hover:bg-[#1E2D6B]/90 text-white"
        >
          {loading ? "Saving…" : "I Accept — Continue"}
        </Button>
      </div>
    </div>
  );
}
