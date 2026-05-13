import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput, parsePhoneString, combinePhone } from "@/components/ui/PhoneInput";

interface ClientProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientProfileDialog({ open, onOpenChange }: ClientProfileDialogProps) {
  const { user, token, updateUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const parsedPhone = parsePhoneString(user?.phone ?? "");
  const [form, setForm] = useState({
    first_name: user?.firstName ?? "",
    last_name: user?.lastName ?? "",
    phoneCountryCode: parsedPhone.countryCode,
    phoneLocal: parsedPhone.local,
    country: user?.country ?? "",
    city: user?.city ?? "",
    linkedin_url: user?.linkedinUrl ?? "",
    bio: user?.bio ?? "",
  });

  const [pwForm, setPwForm] = useState({ new_password: "", confirm: "" });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { phoneCountryCode, phoneLocal, ...rest } = form;
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...rest, phone: combinePhone(phoneCountryCode, phoneLocal) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      updateUser({
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        name: data.user.name,
        phone: data.user.phone,
        country: data.user.country,
        city: data.user.city,
        linkedinUrl: data.user.linkedinUrl,
        bio: data.user.bio,
      });
      toast({ title: "Profile updated" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: e.message ?? "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (pwForm.new_password !== pwForm.confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: pwForm.new_password }),
      });
      if (!res.ok) throw new Error("Password change failed");
      toast({ title: "Password changed successfully" });
      setPwForm({ new_password: "", confirm: "" });
    } catch {
      toast({ title: "Failed to change password", variant: "destructive" });
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name</Label>
              <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Phone</Label>
            <PhoneInput
              countryCode={form.phoneCountryCode}
              phone={form.phoneLocal}
              onCountryCodeChange={(code) => setForm((f) => ({ ...f, phoneCountryCode: code }))}
              onPhoneChange={(v) => setForm((f) => ({ ...f, phoneLocal: v }))}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>LinkedIn URL</Label>
            <Input value={form.linkedin_url} onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))} className="mt-1" placeholder="https://linkedin.com/in/..." />
          </div>
          <div>
            <Label>Bio</Label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] resize-none"
              placeholder="Brief professional summary"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8]">
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>

        <Separator className="my-4" />

        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Change Password</h3>
          <div>
            <Label>New Password</Label>
            <Input type="password" value={pwForm.new_password} onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Confirm Password</Label>
            <Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} className="mt-1" />
          </div>
          <Button variant="outline" onClick={handlePasswordChange} disabled={changingPw} className="w-full">
            {changingPw ? "Changing..." : "Change Password"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
