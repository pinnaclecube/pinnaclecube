import { useState, useRef, useEffect } from "react";
import { COUNTRY_CODES } from "@/lib/countryCodes";
import { ChevronDown, Check, Loader2 } from "lucide-react";

const REASONS = [
  "EB-1A — Extraordinary Ability Assessment",
  "EB-2 NIW — National Interest Waiver",
  "O-1A — Extraordinary Ability (Non-Immigrant)",
  "Evaluating my visa options",
  "Evidence Strategy & Documentation",
  "Elite Blueprint Program",
  "General Inquiry",
];

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  reason: string;
}

export function ContactHeroForm() {
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    countryCode: "+1",
    phone: "",
    reason: "",
  });
  const [ccSearch, setCcSearch] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = COUNTRY_CODES.filter(
    (c) =>
      c.country.toLowerCase().includes(ccSearch.toLowerCase()) ||
      c.code.includes(ccSearch)
  );

  useEffect(() => {
    if (ccOpen && searchRef.current) searchRef.current.focus();
  }, [ccOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCcOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.reason) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Server error");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or email us directly.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === form.countryCode);

  const inputCls =
    "w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition-colors";

  const labelCls = "block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1";

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-2 py-8 gap-4">
        <div className="w-12 h-12 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
          <Check className="w-6 h-6 text-[#F59E0B]" />
        </div>
        <h3 className="text-white font-bold text-lg leading-tight">
          Message received!
        </h3>
        <p className="text-white/60 text-sm leading-relaxed max-w-[220px]">
          A member of our advisory team will be in touch at the earliest opportunity.
        </p>
        <p className="text-white/30 text-xs">Check your inbox for a confirmation.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 h-full">
      <div>
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Get in touch</p>
        <h3 className="text-white font-bold text-base leading-tight">
          Talk to an advisor
        </h3>
      </div>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>First name <span className="text-[#F59E0B]">*</span></label>
          <input
            className={inputCls}
            placeholder="Arjun"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Last name <span className="text-[#F59E0B]">*</span></label>
          <input
            className={inputCls}
            placeholder="Sharma"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            required
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className={labelCls}>Email <span className="text-[#F59E0B]">*</span></label>
        <input
          type="email"
          className={inputCls}
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          required
        />
      </div>

      {/* Phone */}
      <div>
        <label className={labelCls}>Phone</label>
        <div className="flex gap-2">
          {/* Country code dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => { setCcOpen((v) => !v); setCcSearch(""); }}
              className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-md px-2 py-2 text-white text-sm focus:outline-none focus:border-[#F59E0B] hover:border-white/40 transition-colors whitespace-nowrap min-w-[80px]"
            >
              <span className="text-xs">{selectedCountry?.iso ?? "US"}</span>
              <span className="text-white/70 text-xs font-mono">{form.countryCode}</span>
              <ChevronDown className="w-3 h-3 text-white/40 ml-auto" />
            </button>

            {ccOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-[#0F1F4A] border border-white/15 rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-white/10">
                  <input
                    ref={searchRef}
                    value={ccSearch}
                    onChange={(e) => setCcSearch(e.target.value)}
                    placeholder="Search country…"
                    className="w-full bg-white/10 border border-white/15 rounded px-2 py-1.5 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <ul className="max-h-44 overflow-y-auto">
                  {filtered.slice(0, 80).map((c, i) => (
                    <li key={`${c.iso}-${i}`}>
                      <button
                        type="button"
                        onClick={() => {
                          set("countryCode", c.code);
                          setCcOpen(false);
                          setCcSearch("");
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-white/40 font-mono w-4">{c.iso}</span>
                          <span className="truncate max-w-[140px]">{c.country}</span>
                        </span>
                        <span className="font-mono text-white/50 ml-2 shrink-0">{c.code}</span>
                      </button>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="px-3 py-3 text-xs text-white/40 text-center">No results</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <input
            type="tel"
            className={`${inputCls} flex-1`}
            placeholder="555 000 0000"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className={labelCls}>How can we help? <span className="text-[#F59E0B]">*</span></label>
        <select
          className={`${inputCls} cursor-pointer`}
          value={form.reason}
          onChange={(e) => set("reason", e.target.value)}
          required
        >
          <option value="" disabled className="bg-[#1E2D6B]">Select a reason…</option>
          {REASONS.map((r) => (
            <option key={r} value={r} className="bg-[#1E2D6B]">{r}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-red-300 text-xs leading-snug">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-auto w-full bg-[#F59E0B] hover:bg-[#D97706] text-[#1E2D6B] font-bold text-sm py-2.5 rounded-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending…
          </>
        ) : (
          "Send Message"
        )}
      </button>

      <p className="text-white/25 text-[10px] text-center leading-tight">
        No spam. A real advisor will respond within 1–2 business days.
      </p>
    </form>
  );
}
