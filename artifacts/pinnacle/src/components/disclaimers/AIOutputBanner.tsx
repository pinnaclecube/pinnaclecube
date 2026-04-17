import { Bot } from "lucide-react";
import { AI_VARIANTS, type AIVariant } from "@/lib/disclaimers";

interface AIOutputBannerProps {
  variant: AIVariant;
  className?: string;
}

export function AIOutputBanner({ variant, className = "" }: AIOutputBannerProps) {
  return (
    <div
      className={`w-full border-l-4 border-purple-500 bg-purple-50 px-4 py-3 rounded-r-md flex items-start gap-3 mb-6 ${className}`}
      role="note"
      aria-label="AI-generated content disclaimer"
    >
      <Bot className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
      <p className="text-sm text-purple-900 leading-relaxed">
        <span className="font-semibold">AI-generated content. </span>
        {AI_VARIANTS[variant]}
      </p>
    </div>
  );
}
