import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StaffNav from "@/components/layout/StaffNav";
import { getStaffToken } from "@/components/auth/StaffProtectedRoute";
import { Plus, Copy, Check, Trash2, ToggleLeft, ToggleRight, QrCode, ExternalLink } from "lucide-react";

function staffFetch(path: string, opts: RequestInit = {}) {
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      "X-Staff-Token": getStaffToken() ?? "",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

type BoothEvent = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
};

function boothUrl(event: BoothEvent): string {
  const base = window.location.origin;
  return `${base}/booth?event=${encodeURIComponent(event.name)}`;
}

export default function InternalBoothEvents() {
  const [events, setEvents] = useState<BoothEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BoothEvent | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await staffFetch("/admin/booth-events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateError("");
    setSaving(true);
    try {
      const res = await staffFetch("/admin/booth-events", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to create event");
      }
      setNewName("");
      setShowCreate(false);
      await load();
    } catch (err: any) {
      setCreateError(err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (event: BoothEvent) => {
    await navigator.clipboard.writeText(boothUrl(event));
    setCopied(event.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleToggle = async (event: BoothEvent) => {
    await staffFetch(`/admin/booth-events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !event.active }),
    });
    await load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id);
    try {
      await staffFetch(`/admin/booth-events/${confirmDelete.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      await load();
    } finally {
      setDeleting(null);
    }
  };

  const activeEvents = events.filter((e) => e.active);
  const inactiveEvents = events.filter((e) => !e.active);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StaffNav />

      <div className="flex-1 px-8 py-8 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Booth Events</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create shareable booth capture links for conferences and events.
            </p>
          </div>
          <Button
            onClick={() => { setShowCreate(true); setNewName(""); setCreateError(""); }}
            className="bg-[#1E2D6B] hover:bg-[#3D4FA8] gap-2"
          >
            <Plus className="w-4 h-4" /> New Event
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No events yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Create your first event to get a booth capture link.
            </p>
            <Button
              onClick={() => { setShowCreate(true); setNewName(""); setCreateError(""); }}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" /> New Event
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active events */}
            {activeEvents.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Active ({activeEvents.length})
                </h2>
                <div className="space-y-3">
                  {activeEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onCopy={handleCopy}
                      onToggle={handleToggle}
                      onDelete={() => setConfirmDelete(event)}
                      copied={copied === event.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Inactive events */}
            {inactiveEvents.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Inactive ({inactiveEvents.length})
                </h2>
                <div className="space-y-3">
                  {inactiveEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onCopy={handleCopy}
                      onToggle={handleToggle}
                      onDelete={() => setConfirmDelete(event)}
                      copied={copied === event.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Booth Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="eventName" className="text-sm font-medium">
                  Event Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="eventName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. AILA Conference 2026"
                  className="mt-1 h-11"
                  autoFocus
                  required
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  This name will appear on the booth capture form and be used as the URL parameter.
                </p>
              </div>
              {newName.trim() && (
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs font-mono text-muted-foreground break-all">
                  {`${window.location.origin}/booth?event=${encodeURIComponent(newName.trim())}`}
                </div>
              )}
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{createError}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !newName.trim()}
                className="bg-[#1E2D6B] hover:bg-[#3D4FA8]"
              >
                {saving ? "Creating…" : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm modal */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Event?</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{confirmDelete?.name}</span>?
              This cannot be undone. Any existing leads captured under this event will remain in the Prospects panel.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting === confirmDelete?.id}
              onClick={handleDelete}
            >
              {deleting === confirmDelete?.id ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventCard({
  event,
  onCopy,
  onToggle,
  onDelete,
  copied,
}: {
  event: BoothEvent;
  onCopy: (e: BoothEvent) => void;
  onToggle: (e: BoothEvent) => void;
  onDelete: () => void;
  copied: boolean;
}) {
  const url = boothUrl(event);
  const date = new Date(event.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Card className={event.active ? "" : "opacity-60"}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 truncate">{event.name}</span>
              <Badge
                className={
                  event.active
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-500 border-gray-200"
                }
                variant="outline"
              >
                {event.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground truncate">{url}</p>
            <p className="text-xs text-muted-foreground mt-1">Created {date}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Copy link */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(event)}
              title="Copy booth link"
              className="h-8 w-8 p-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
            </Button>

            {/* Open in new tab */}
            <Button
              variant="ghost"
              size="sm"
              asChild
              title="Open booth page"
              className="h-8 w-8 p-0"
            >
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 text-gray-500" />
              </a>
            </Button>

            {/* Toggle active */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggle(event)}
              title={event.active ? "Deactivate" : "Activate"}
              className="h-8 w-8 p-0"
            >
              {event.active ? (
                <ToggleRight className="w-4 h-4 text-green-600" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-gray-400" />
              )}
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title="Delete event"
              className="h-8 w-8 p-0 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
