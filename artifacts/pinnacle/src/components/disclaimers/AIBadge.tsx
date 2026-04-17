import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bot } from "lucide-react";
import { type AIVariant, AI_VARIANTS } from "@/lib/disclaimers";

interface AIBadgeProps {
  variant?: AIVariant;
  className?: string;
}

export function AIBadge({ variant = "summary", className = "" }: AIBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 cursor-help select-none ${className}`}
          aria-label="AI-generated content — click for disclaimer"
        >
          <Bot className="w-3 h-3" />
          AI
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {AI_VARIANTS[variant]}
      </TooltipContent>
    </Tooltip>
  );
}
