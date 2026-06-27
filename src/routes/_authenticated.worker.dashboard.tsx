import { useState } from "react";
import { Droplet, Bell, Plus, Truck, Receipt } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { WorkerShell } from "@/components/worker-shell";
import { formatRs, formatTime, greeting, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/worker/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Shifaf Aab" }] }),
  component: WorkerDashboard,
});

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function WorkerDashboard() {
  const { user, name } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bottles, setBottles] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  const today = startOfToday();

  const lotsQ = useQuery({
    queryKey: ["lots", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lots")
        .select("*, deliveries(bottles_delivered, total_amount)")
        .eq("worker_id", user!.id)
        .gte("created_at", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const expensesQ = useQuery({
    queryKey: ["expenses-today", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .eq("worker_id", user!.id)
        .gte("created_at", today);
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
      .channel("worker-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `worker_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["lots"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lots", filter: `worker_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["lots"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["worker-notifs"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const lots = lotsQ.data ?? [];
  const totalBottlesSold = lots.reduce((s, l: any) => s + (l.deliveries?.reduce((a: number, d: any) => a + d.bottles_delivered, 0) ?? 0), 0);
  const totalRevenue = lots.reduce((s, l: any) => s + (l.deliveries?.reduce((a: number, d: any) => a + Number(d.total_amount), 0) ?? 0), 0);
  const activeLots = lots.filter((l: any) => l.status === "active").length;
  const totalExpenses = (expensesQ.data ?? []).reduce((s, e: any) => s + Number(e.amount), 0);
  const notifications = notificationsQ.data ?? [];
  const hasUnreadNotifs = notifications.some((n: any) => !n.is_read);

  const createLot = useMutation({
    mutationFn: async (n: number) => {
      const { data, error } = await supabase
        .from("lots")
        .insert({ worker_id: user!.id, total_bottles: n })
        .select()
        .single();
      if (error) throw error;
      // notify admins
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.user_id,
            kind: "lot_started",
            message: `${name || "Worker"} started a new lot of ${n} bottles`,
          }))
        );
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lots"] });
      setSheetOpen(false);
      setBottles("");
      toast.success("Lot started");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create lot"),
  });

  return (
    <WorkerShell>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <h1 className="text-xl font-bold text-primary truncate">{greeting()}, {name || "there"} 👋</h1>
        </div>
        <button
          onClick={() => {
            setNotifOpen(true);
            if (hasUnreadNotifs) markAllRead.mutate();
          }}
          className="h-10 w-10 grid place-items-center rounded-full text-primary relative"
        >
          <Bell className="h-5 w-5" />
          {hasUnreadNotifs && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
        </button>
      </header>

      <div className="px-5 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Bottles Sold" value={String(totalBottlesSold)} icon={<Droplet className="h-4 w-4 text-primary" />} sub="today" />
          <KpiCard label="Revenue" value={formatRs(totalRevenue)} icon={<Receipt className="h-4 w-4 text-success" />} sub="today" tone="primary" />
          <KpiCard label="Active Lots" value={String(activeLots)} icon={<Truck className="h-4 w-4 text-warning" />} sub={activeLots ? "in progress" : "none"} tone="warning" />
          <KpiCard label="Expenses" value={formatRs(totalExpenses)} icon={<Receipt className="h-4 w-4 text-destructive" />} sub="today" />
        </div>

        <button
          onClick={() => setSheetOpen(true)}
          className="h-14 w-full rounded-[10px] bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" /> Start New Lot
        </button>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Today's Lots</h2>
          </div>
          {lotsQ.isLoading ? (
            <div className="space-y-3">
              <div className="h-20 rounded-xl bg-muted animate-pulse" />
              <div className="h-20 rounded-xl bg-muted animate-pulse" />
            </div>
          ) : lots.length === 0 ? (
            <EmptyState icon={<Truck className="h-8 w-8 text-muted-foreground" />} title="No lots yet" hint="Start a new lot to begin logging deliveries." />
          ) : (
            <div className="space-y-3">
              {lots.map((l: any) => {
                const sold = l.deliveries?.reduce((a: number, d: any) => a + d.bottles_delivered, 0) ?? 0;
                const active = l.status === "active";
                return (
                  <button
                    key={l.id}
                    onClick={() => navigate({ to: "/worker/deliveries", search: { lotId: l.id } })}
                    className="w-full text-left card-surface relative pl-4 pr-4 py-3.5 flex items-center gap-3"
                  >
                    <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r ${active ? "bg-primary" : "bg-success"}`} />
                    <div className="h-12 w-12 rounded-xl bg-muted grid place-items-center">
                      <Truck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">Lot #{l.id.slice(0, 6).toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{active ? "Started" : "Completed"} {formatTime(l.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{sold} / {l.total_bottles}</p>
                      <span className={`mt-1 inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded ${active ? "bg-primary text-primary-foreground" : "bg-success/15 text-success"}`}>
                        {active ? "Active" : "Done"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNotifOpen(false)} />
          <div className="relative w-full max-w-[320px] h-full bg-card border-l border-border p-5 flex flex-col animate-in slide-in-from-right duration-250">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h2 className="font-bold text-lg">My Activity</h2>
              <button onClick={() => setNotifOpen(false)} className="text-sm font-semibold text-muted-foreground">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {notificationsQ.isLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-10 bg-muted rounded-lg" />
                  <div className="h-10 bg-muted rounded-lg" />
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No confirmations yet.</p>
              ) : (
                notifications.map((n: any) => (
                  <div key={n.id} className="p-3 border border-border rounded-xl bg-muted/40 text-xs">
                    <p className="font-medium text-foreground">{n.message} · {relativeTime(n.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <NewLotSheet
          bottles={bottles}
          setBottles={setBottles}
          onClose={() => setSheetOpen(false)}
          onSubmit={() => {
            const n = parseInt(bottles, 10);
            if (!n || n <= 0) return;
            createLot.mutate(n);
          }}
          submitting={createLot.isPending}
        />
      )}
    </WorkerShell>
  );
}

function KpiCard({ label, value, icon, sub, tone }: { label: string; value: string; icon: React.ReactNode; sub?: string; tone?: "primary" | "warning" }) {
  const valueClass = tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon} <span className="truncate">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="card-surface p-8 flex flex-col items-center text-center">
      <div className="h-14 w-14 rounded-full bg-muted grid place-items-center">{icon}</div>
      <p className="mt-3 font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function NewLotSheet({ bottles, setBottles, onClose, onSubmit, submitting }: { bottles: string; setBottles: (v: string) => void; onClose: () => void; onSubmit: () => void; submitting: boolean }) {
  const [error, setError] = useState("");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  const press = (k: string) => {
    setError("");
    if (k === "⌫") setBottles(bottles.slice(0, -1));
    else if (k !== "") setBottles((bottles + k).replace(/^0+(?=\d)/, "").slice(0, 4));
  };
  const n = parseInt(bottles || "0", 10);
  const handleStart = () => {
    if (!n || n <= 0) {
      setError("Please enter a valid number of bottles greater than 0");
      return;
    }
    setError("");
    onSubmit();
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 bg-card rounded-t-[20px] mx-auto max-w-[390px] p-6 animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <h2 className="text-center text-3xl font-bold">New Lot</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">Enter the number of bottles you're taking out</p>

        <div className="mt-8 flex items-end justify-center gap-2">
          <span className={`text-6xl font-bold leading-none ${n ? "text-primary" : "text-accent"}`}>{bottles || "0"}</span>
          <span className="text-xl font-bold tracking-widest text-muted-foreground pb-2">BOTTLES</span>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-2">
          {keys.map((k, i) => (
            <button
              key={i}
              type="button"
              disabled={!k}
              onClick={() => press(k)}
              className="h-14 rounded-xl text-2xl font-semibold disabled:opacity-0 active:bg-accent/40 transition-colors"
            >
              {k}
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={submitting}
          className="mt-6 h-12 w-full rounded-[10px] bg-primary text-primary-foreground font-semibold disabled:bg-muted-foreground/40 disabled:text-card"
        >
          {submitting ? "Starting..." : "Start Lot"}
        </button>
        {error && <p className="text-xs text-destructive text-center mt-2 font-semibold">{error}</p>}
        <button onClick={onClose} className="mt-3 h-10 w-full text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Cancel
        </button>
      </div>
    </div>
  );
}
