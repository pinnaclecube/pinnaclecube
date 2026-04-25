import { useState, useRef, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, UserPlus, ChevronDown, ArrowRight } from "lucide-react";
import { COUNTRY_CODES } from "@/lib/countryCodes";

const QR_REDIRECT_SECONDS = 5;

const VISA_OPTIONS = [
  "EB-1A — Extraordinary Ability Assessment",
  "EB-2 NIW — National Interest Waiver",
  "O-1A — Extraordinary Ability (Non-Immigrant)",
  "Evaluating my visa options",
  "Evidence Strategy & Documentation",
  "Elite Blueprint Program",
  "General Inquiry",
];

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  fieldOfWork: string;
  visaTarget: string;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  countryCode: "+1",
  phone: "",
  fieldOfWork: "",
  visaTarget: "",
};

export default function BoothCapture() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const eventName = params.get("event") ?? undefined;
  const isQrMode = params.get("mode") === "qr";

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [ccSearch, setCcSearch] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [capturedName, setCapturedName] = useState("");
  const [countdown, setCountdown] = useState(QR_REDIRECT_SECONDS);

  useEffect(() => {
    if (!isQrMode || !success) return;
    setCountdown(QR_REDIRECT_SECONDS);
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          navigate("/");
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isQrMode, success]);

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

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === form.countryCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const phone = form.phone.trim()
        ? `${form.countryCode} ${form.phone.trim()}`
        : undefined;
      const res = await fetch("/api/booth/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          email: form.email.trim(),
          phone,
          fieldOfWork: form.fieldOfWork.trim() || undefined,
          visaTarget: form.visaTarget || undefined,
          eventName: eventName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setCapturedName(form.firstName.trim());
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnother = () => {
    setForm(EMPTY_FORM);
    setCcSearch("");
    setCcOpen(false);
    setSuccess(false);
    setCapturedName("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#1E2D6B] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-xl px-5 py-3">
            <Logo />
          </div>
        </div>

        {success ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Got it, {capturedName}!</h2>
            <p className="text-muted-foreground mb-2 leading-relaxed">
              Thanks for stopping by. We've sent a follow-up to your inbox.
            </p>
            {eventName && (
              <p className="text-sm text-indigo-600 font-medium mb-4">{eventName}</p>
            )}

            {isQrMode ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Redirecting you to Pinnacle³ in{" "}
                  <span className="font-bold text-[#1E2D6B] tabular-nums">{countdown}</span>s…
                </p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#1E2D6B] h-1.5 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(countdown / QR_REDIRECT_SECONDS) * 100}%` }}
                  />
                </div>
                <Button
                  onClick={() => navigate("/")}
                  className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base mt-1"
                >
                  Explore Pinnacle³ <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleAnother}
                className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base"
              >
                <UserPlus className="w-4 h-4 mr-2" /> Thank You, Go To Next
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Connect with Pinnacle³</h1>
              {eventName ? (
                <p className="text-sm text-indigo-600 font-medium mt-1">{eventName}</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Leave your details and we'll follow up.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={set("firstName")}
                    placeholder="Jane"
                    className="mt-1 h-11 text-base"
                    required
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={set("lastName")}
                    placeholder="Smith"
                    className="mt-1 h-11 text-base"
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="jane@example.com"
                  className="mt-1 h-11 text-base"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Phone: country code + number */}
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Phone <span className="text-xs">(optional)</span>
                </Label>
                <div className="flex gap-2 mt-1">
                  {/* Country code dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => { setCcOpen((v) => !v); setCcSearch(""); }}
                      className="flex items-center gap-1 h-11 border border-input bg-background rounded-md px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring hover:border-gray-400 transition-colors whitespace-nowrap min-w-[82px]"
                    >
                      <span className="text-xs text-muted-foreground font-medium">
                        {selectedCountry?.iso ?? "US"}
                      </span>
                      <span className="text-xs font-mono">{form.countryCode}</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
                    </button>

                    {ccOpen && (
                      <div className="absolute top-full left-0 mt-1 w-68 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 overflow-hidden" style={{ width: 260 }}>
                        <div className="p-2 border-b border-gray-100">
                          <input
                            ref={searchRef}
                            value={ccSearch}
                            onChange={(e) => setCcSearch(e.target.value)}
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
                                  setForm((f) => ({ ...f, countryCode: c.code }));
                                  setCcOpen(false);
                                  setCcSearch("");
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
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="555 000 0000"
                    className="flex-1 h-11 text-base"
                    autoComplete="tel-national"
                  />
                </div>
              </div>

              {/* Field of work */}
              <div>
                <Label htmlFor="fieldOfWork" className="text-sm font-medium text-muted-foreground">
                  Field / Industry <span className="text-xs">(optional)</span>
                </Label>
                <Input
                  id="fieldOfWork"
                  value={form.fieldOfWork}
                  onChange={set("fieldOfWork")}
                  placeholder="e.g. AI Research, Biotech, Engineering"
                  className="mt-1 h-11 text-base"
                />
              </div>

              {/* Visa Interest */}
              <div>
                <Label htmlFor="visaTarget" className="text-sm font-medium text-muted-foreground">
                  Visa Interest <span className="text-xs">(optional)</span>
                </Label>
                <Select
                  value={form.visaTarget}
                  onValueChange={(v) => setForm((f) => ({ ...f, visaTarget: v }))}
                >
                  <SelectTrigger className="mt-1 h-11 text-base" id="visaTarget">
                    <SelectValue placeholder="Select a visa category" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISA_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base mt-2"
              >
                {submitting ? "Saving…" : "Submit"}
              </Button>
            </form>
          </div>
        )}

        <p className="text-center text-white/50 text-xs mt-6">
          Not a law firm · Advisory consulting only · pinnaclecube.com
        </p>
      </div>
    </div>
  );
}
