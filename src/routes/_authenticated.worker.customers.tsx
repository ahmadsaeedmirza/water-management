import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Truck, MapPin, Bell, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkerShell } from "@/components/worker-shell";
import { useAuth } from "@/lib/auth";
import { initials, relativeTime, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/worker/customers")({
  component: CustomersPage,
});

const AVATAR_TONES = [
  "bg-accent/60 text-primary",
  "bg-secondary/30 text-primary",
  "bg-primary/15 text-primary",
];

function CustomersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const notificationsQ = useQuery({
    queryKey: ["worker-notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker-notifs"] });
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("worker-customers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["worker-notifs"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const all = customersQ.data ?? [];
  const filtered = all.filter((c) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return c.name.toLowerCase().includes(t) || c.address.toLowerCase().includes(t);
  });
  const notifications = notificationsQ.data ?? [];
  const hasUnreadNotifs = notifications.some((n: any) => !n.is_read);

  return (
    <WorkerShell>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Shifaf Aab</h1>
        <button
          onClick={() => {
            setNotifOpen(true);
            if (hasUnreadNotifs) markAllRead.mutate();
          }}
          className="h-10 w-10 grid place-items-center text-primary relative"
        >
          <Bell className="h-5 w-5" />
          {hasUnreadNotifs && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
        </button>
      </header>

      <div className="px-5 py-5 space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Worker Customers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and log deliveries for your route.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers by name or address"
            className="h-12 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="TOTAL" value={String(all.length)} tone="text-primary" />
          <Stat label="ACTIVE" value={String(all.length)} tone="text-success" />
        </div>

        {customersQ.isLoading ? (
          <div className="space-y-3">
            <div className="h-28 rounded-xl bg-muted animate-pulse" />
            <div className="h-28 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3 bg-card rounded-xl border border-border">
            <Users className="h-12 w-12 text-[#90E0EF]" />
            <p className="text-[#64748B] text-sm font-medium">No customers added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c, i) => (
              <div key={c.id} className="card-surface p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`h-12 w-12 shrink-0 rounded-full grid place-items-center font-bold ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
                  >
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    navigate({ to: "/worker/deliveries", search: { customer_id: c.id, lotId: undefined } })
                  }
                  className="mt-3 h-10 px-4 rounded-[10px] bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Truck className="h-4 w-4" /> Log Delivery
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNotifOpen(false)} />
          <div className="relative w-full max-w-[320px] h-full bg-card border-l border-border p-5 flex flex-col animate-in slide-in-from-right duration-250">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h2 className="font-bold text-lg">My Activity</h2>
              <button
                onClick={() => setNotifOpen(false)}
                className="text-sm font-semibold text-muted-foreground"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {notificationsQ.isLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-10 bg-muted rounded-lg" />
                  <div className="h-10 bg-muted rounded-lg" />
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No confirmations yet.
                </p>
              ) : (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className="p-3 border border-border rounded-xl bg-muted/40 text-xs"
                  >
                    <p className="font-medium text-foreground">
                      {n.message} · {relativeTime(n.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </WorkerShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="card-surface p-3">
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
