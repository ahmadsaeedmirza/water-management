import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Search, Truck, MapPin, Bell, Users, CreditCard, ChevronDown, Phone, X, Plus, Banknote, Globe } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkerShell } from "@/components/worker-shell";
import { useAuth } from "@/lib/auth";
import { initials, relativeTime, formatTime, formatRs, formatDate } from "@/lib/format";
import { toast } from "sonner";

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
  const [openedCustomer, setOpenedCustomer] = useState<any>(null);
  const [routeFilter, setRouteFilter] = useState<"All" | "A" | "B">("All");

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "*, deliveries(bottles_delivered, total_amount, payment_mode, created_at, price_per_bottle), payments(amount, created_at, payment_mode)",
        )
        .order("name");
      if (error) throw error;
      return data ?? [];
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
  const filtered = all.filter((c: any) => {
    if (routeFilter !== "All" && c.route !== routeFilter) return false;
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

        <div className="flex gap-2">
          {(["All", "A", "B"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRouteFilter(r)}
              className={`px-4 h-9 rounded-full text-xs font-semibold border transition-all ${
                routeFilter === r
                  ? "bg-[#0077B6] text-white border-[#0077B6]"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {r === "All" ? "All Routes" : `Route ${r}`}
            </button>
          ))}
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
                <div
                  className="flex items-start gap-3 cursor-pointer hover:opacity-85 transition-opacity"
                  onClick={() => setOpenedCustomer(c)}
                >
                  <div
                    className={`h-12 w-12 shrink-0 rounded-full grid place-items-center font-bold ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
                  >
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold truncate">{c.name}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#0077B6] border border-[#0077B6] shrink-0">
                        Route {c.route || "A"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      navigate({ to: "/worker/deliveries", search: { customer_id: c.id, lotId: undefined } })
                    }
                    className="flex-1 h-10 px-3 rounded-[10px] bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                  >
                    <Truck className="h-4 w-4" /> Log Delivery
                  </button>
                  <button
                    onClick={() => setOpenedCustomer(c)}
                    className="flex-1 h-10 px-3 rounded-[10px] border border-border bg-card text-muted-foreground hover:bg-muted text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="h-4 w-4" /> Record Payment
                  </button>
                </div>
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
      {openedCustomer && (
        <LedgerDrawer
          customer={openedCustomer}
          onClose={() => setOpenedCustomer(null)}
        />
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

function LedgerDrawer({ customer, onClose }: { customer: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "card" | "online">("cash");
  const [activeTab, setActiveTab] = useState<"deliveries" | "payments">("deliveries");

  const totalBilled = (customer.deliveries ?? [])
    .filter((d: any) => d.payment_mode === "pending")
    .reduce((a: number, d: any) => a + Number(d.total_amount), 0);
  const totalPaid = (customer.payments ?? []).reduce(
    (a: number, p: any) => a + Number(p.amount),
    0,
  );
  const balance = totalBilled - totalPaid;

  const deliveriesList = useMemo(() => {
    return [...(customer.deliveries ?? [])].sort(
      (a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at),
    );
  }, [customer]);

  const paymentsList = useMemo(() => {
    return [...(customer.payments ?? [])].sort(
      (a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at),
    );
  }, [customer]);

  const pay = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.from("payments").insert({
        customer_id: customer.id,
        amount: amt,
        payment_mode: mode,
        recorded_by: user!.id,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        kind: "payment",
        message: `Worker recorded payment of ${formatRs(amt)} from ${customer.name}`,
      });
      import("@/lib/push-server").then(({ notifyAdminsPush }) => {
        notifyAdminsPush({
          data: {
            title: "Payment Recorded 💳",
            body: `Worker recorded payment of ${formatRs(amt)} from ${customer.name} (${mode.toUpperCase()})`,
            url: "/admin/customers",
          },
        });
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayOpen(false);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-border flex flex-col animate-in slide-in-from-right duration-250">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-accent grid place-items-center text-primary font-bold">
            {initials(customer.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold truncate">{customer.name}</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#0077B6] border border-[#0077B6] shrink-0">
                Route {customer.route || "A"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Rs. {customer.price_per_bottle}/bottle
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-[10px] grid place-items-center hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2 border-b border-border">
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" /> {customer.phone}
            </div>
          )}
          {customer.address && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {customer.address}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <LedgerStat label="Pending Dues" value={formatRs(totalBilled)} />
            <LedgerStat label="Payments" value={formatRs(totalPaid)} tone="success" />
            <LedgerStat
              label="Balance Due"
              value={balance < 0 ? "Overpaid" : balance === 0 ? "Rs. 0" : formatRs(balance)}
              tone={balance > 0 ? "warning" : "success"}
            />
          </div>
        </div>

        <div className="flex border-b border-border px-5 shrink-0 bg-muted/10">
          {(["deliveries", "payments"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 text-xs font-bold uppercase border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "deliveries" ? (
            deliveriesList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
                <Truck className="h-12 w-12 text-[#90E0EF]" />
                <p className="text-[#64748B] text-sm font-medium">No deliveries recorded yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {deliveriesList.map((d: any, i) => (
                  <li key={i} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {d.bottles_delivered} bottle(s) · {formatRs(d.price_per_bottle)}/each
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        {formatDate(d.created_at)} · {formatTime(d.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{formatRs(d.total_amount)}</p>
                      <span
                        className={`text-[10px] font-bold uppercase ${d.payment_mode === "pending" ? "text-warning" : "text-success"}`}
                      >
                        {d.payment_mode}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : paymentsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
              <CreditCard className="h-12 w-12 text-[#90E0EF]" />
              <p className="text-[#64748B] text-sm font-medium">No payments recorded yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {paymentsList.map((p: any, i) => (
                <li key={i} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">Payment Received</p>
                    <p className="text-muted-foreground mt-0.5">
                      {formatDate(p.created_at)} · {formatTime(p.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-success tabular-nums">+ {formatRs(p.amount)}</p>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      {p.payment_mode}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-border bg-card">
          <button
            onClick={() => setPayOpen(true)}
            className="w-full h-12 rounded-[10px] bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-2 hover:opacity-95"
          >
            <Plus className="h-5 w-5" /> Record Payment
          </button>
        </div>

        {payOpen && (
          <div
            className="absolute inset-0 z-10 flex items-end bg-black/40"
            onClick={() => setPayOpen(false)}
          >
            <div
              className="w-full bg-card rounded-t-3xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" />
              <h3 className="font-bold text-lg">Record Payment</h3>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Amount</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="mt-1 w-full h-14 px-4 rounded-[10px] border border-border bg-background text-2xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Method</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["cash", Banknote, "Cash"],
                      ["card", CreditCard, "Card"],
                      ["online", Globe, "Online"],
                    ] as const
                  ).map(([k, Icon, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMode(k)}
                      className={`h-14 rounded-[10px] border-2 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${mode === k ? "border-primary bg-accent/40 text-primary" : "border-border bg-card text-muted-foreground"}`}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => pay.mutate()}
                disabled={pay.isPending}
                className="w-full h-12 rounded-[10px] bg-primary text-primary-foreground font-bold disabled:opacity-50"
              >
                {pay.isPending ? "Recording…" : "Confirm"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LedgerStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const cls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-[10px] bg-muted/50 p-2.5">
      <p className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums truncate ${cls}`}>{value}</p>
    </div>
  );
}
