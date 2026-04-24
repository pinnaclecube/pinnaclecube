import { useState } from "react";
import { useSearch } from "wouter";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, UserPlus } from "lucide-react";

const VISA_OPTIONS = [
  { value: "EB-1A", label: "EB-1A — Extraordinary Ability" },
  { value: "EB-2 NIW", label: "EB-2 NIW — National Interest Waiver" },
  { value: "O-1A", label: "O-1A — Extraordinary Ability (Non-immigrant)" },
  { value: "Not sure", label: "Not sure yet" },
];

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  fieldOfWork: string;
  visaTarget: string;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  phone: "",
  fieldOfWork: "",
  visaTarget: "",
};

export default function BoothCapture() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const eventName = params.get("event") ?? undefined;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [capturedName, setCapturedName] = useState("");

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/booth/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          fieldOfWork: form.fieldOfWork.trim() || undefined,
          visaTarget: form.visaTarget || undefined,
          eventName: eventName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setCapturedName(form.fullName.split(" ")[0] ?? form.fullName);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnother = () => {
    setForm(EMPTY_FORM);
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
              <p className="text-sm text-indigo-600 font-medium mb-6">{eventName}</p>
            )}
            <Button
              onClick={handleAnother}
              className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8] h-12 text-base"
            >
              <UserPlus className="w-4 h-4 mr-2" /> Capture another lead
            </Button>
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
              <div>
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={set("fullName")}
                  placeholder="Jane Smith"
                  className="mt-1 h-11 text-base"
                  required
                  autoComplete="name"
                />
              </div>

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

              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-muted-foreground">
                  Phone <span className="text-xs">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="+1 614 555 0123"
                  className="mt-1 h-11 text-base"
                  autoComplete="tel"
                />
              </div>

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
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
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
