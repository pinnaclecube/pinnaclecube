import { InfoIcon } from "lucide-react";

export function AIBanner() {
  return (
    <div className="w-full bg-blue-50 border border-blue-100 px-4 py-2 rounded-md flex items-center gap-3 text-sm text-blue-800 mb-6">
      <InfoIcon className="w-4 h-4 text-blue-500 shrink-0" />
      <p>AI-generated content — verify with your attorney</p>
    </div>
  );
}
