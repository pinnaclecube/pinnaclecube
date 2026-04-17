import { TriangleAlert } from "lucide-react";
import { AI_VARIANTS } from "@/lib/disclaimers";

export function LessonDisclaimer() {
  return (
    <div
      className="w-full bg-amber-50 border border-amber-200 rounded-md px-4 py-3 flex items-start gap-3 mb-6"
      role="note"
      aria-label="Lesson disclaimer"
    >
      <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-sm text-amber-900 leading-relaxed space-y-1">
        <p>
          <span className="font-semibold">AI-generated educational content. </span>
          {AI_VARIANTS.lesson}
        </p>
        <p className="font-medium">
          Immigration laws change — always verify with a licensed attorney before acting.
        </p>
      </div>
    </div>
  );
}
