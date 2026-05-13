import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COUNTRY_CODES } from "@/lib/countryCodes";

interface PhoneInputProps {
  countryCode: string;
  phone: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneChange: (phone: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function PhoneInput({
  countryCode,
  phone,
  onCountryCodeChange,
  onPhoneChange,
  required,
  placeholder = "555 000 0000",
  className,
  inputClassName,
}: PhoneInputProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = COUNTRY_CODES.filter(
    (c) =>
      c.country.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search),
  );

  const selectedCountry =
    COUNTRY_CODES.find((c) => c.code === countryCode && c.iso === "US") ??
    COUNTRY_CODES.find((c) => c.code === countryCode);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setSearch("");
          }}
          className="flex items-center gap-1 h-9 border border-input bg-background rounded-md px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring hover:border-gray-400 transition-colors whitespace-nowrap min-w-[84px]"
        >
          <span className="text-xs text-muted-foreground font-medium">
            {selectedCountry?.iso ?? "US"}
          </span>
          <span className="text-xs font-mono">{countryCode}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
        </button>

        {open && (
          <div
            className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 overflow-hidden"
            style={{ width: 260 }}
          >
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country…"
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <ul className="max-h-48 overflow-y-auto">
              {filtered.slice(0, 80).map((c, i) => (
                <li key={`${c.iso}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onCountryCodeChange(c.code);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-gray-400 font-mono w-6">{c.iso}</span>
                      <span className="truncate max-w-[140px]">{c.country}</span>
                    </span>
                    <span className="font-mono text-gray-400 ml-2 shrink-0">{c.code}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-3 text-xs text-gray-400 text-center">No results</li>
              )}
            </ul>
          </div>
        )}
      </div>

      <Input
        type="tel"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 ${inputClassName ?? ""}`}
        autoComplete="tel-national"
        required={required}
      />
    </div>
  );
}

export function parsePhoneString(combined: string): { countryCode: string; local: string } {
  if (!combined) return { countryCode: "+1", local: "" };
  const trimmed = combined.trim();
  if (trimmed.startsWith("+")) {
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx > 0) {
      return { countryCode: trimmed.slice(0, spaceIdx), local: trimmed.slice(spaceIdx + 1) };
    }
    return { countryCode: trimmed, local: "" };
  }
  return { countryCode: "+1", local: trimmed };
}

export function combinePhone(countryCode: string, local: string): string {
  const l = local.trim();
  if (!l) return "";
  return `${countryCode} ${l}`;
}
