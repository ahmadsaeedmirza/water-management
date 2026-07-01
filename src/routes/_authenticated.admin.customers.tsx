import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { formatRs, formatDate, formatTime, initials } from "@/lib/format";
import { Search, Plus, X, Banknote, CreditCard, Globe, Phone, MapPin, Users, Truck, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [routeFilter, setRouteFilter] = useState<"All" | "A" | "B">("All");
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<any>(null);

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["adm-customers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const customersQ = useQuery({
    queryKey: ["adm-customers"],
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

  useEffect(() => {
    const ch = supabase
      .channel("adm-customers")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () =>
        qc.invalidateQueries({ queryKey: ["adm-customers"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () =>
        qc.invalidateQueries({ queryKey: ["adm-customers"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () =>
        qc.invalidateQueries({ queryKey: ["adm-customers"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const customers = customersQ.data ?? [];
  const filtered = useMemo(() => {
    return customers.filter((c: any) => {
      if (routeFilter !== "All" && c.route !== routeFilter) return false;
      return c.name.toLowerCase().includes(q.toLowerCase());
    });
  }, [customers, q, routeFilter]);
  const opened = customers.find((c: any) => c.id === openId);

  const totalDues = customers.reduce((sum: number, c: any) => {
    const pendingSum = (c.deliveries ?? [])
      .filter((d: any) => d.payment_mode === "pending")
      .reduce((a: number, d: any) => a + Number(d.total_amount), 0);
    const paymentsSum = (c.payments ?? []).reduce(
      (a: number, p: any) => a + Number(p.amount),
      0,
    );
    const dues = Math.max(0, pendingSum - paymentsSum);
    return sum + dues;
  }, 0);

  return (
    <AdminShell
      title="Customers"
      subtitle={`${customers.length} registered · ${formatRs(totalDues)} in dues`}
      right={
        <button
          onClick={() => setAdding(true)}
          className="h-10 px-4 rounded-[10px] bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Customer</span>
        </button>
      }
    >
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers…"
          className="w-full h-11 pl-10 pr-4 rounded-[10px] border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex gap-2 mb-4">
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

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-card rounded-xl border border-border space-y-3">
          <Users className="h-12 w-12 text-[#90E0EF]" />
          <p className="text-[#64748B] text-sm font-medium">No customers found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c: any) => {
            const pendingSum = (c.deliveries ?? [])
              .filter((d: any) => d.payment_mode === "pending")
              .reduce((a: number, d: any) => a + Number(d.total_amount), 0);
            const paymentsSum = (c.payments ?? []).reduce(
              (a: number, p: any) => a + Number(p.amount),
              0,
            );
            const dues = pendingSum - paymentsSum;
            const bottles = (c.deliveries ?? []).reduce(
              (a: number, d: any) => a + d.bottles_delivered,
              0,
            );
            return (
              <div
                key={c.id}
                className="card-surface p-4 flex flex-col justify-between hover:border-primary/40 transition-colors"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setOpenId(c.id)}
                >
                  <div className="h-11 w-11 rounded-full bg-accent grid place-items-center text-primary font-bold text-sm shrink-0">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm truncate">{c.name}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#0077B6] border border-[#0077B6] shrink-0">
                        Route {c.route || "A"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.phone || "No phone"}
                    </p>
                    {c.address && (
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-0.5 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{c.address}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <div className="cursor-pointer flex-1" onClick={() => setOpenId(c.id)}>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">
                      Bottles
                    </p>
                    <p className="font-bold tabular-nums">{bottles}</p>
                  </div>
                  <div className="cursor-pointer flex-1 text-center" onClick={() => setOpenId(c.id)}>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">
                      Dues
                    </p>
                    <p
                      className={`font-bold tabular-nums text-xs ${dues > 0 ? "text-warning" : "text-success"}`}
                    >
                      {dues < 0 ? "Overpaid" : dues === 0 ? "Rs. 0" : formatRs(dues)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 pl-2">
                    <button
                      onClick={() => setEditingCustomer(c)}
                      className="h-8 w-8 rounded-lg border border-border bg-card text-[#64748B] hover:bg-muted hover:text-primary grid place-items-center transition-colors"
                      title="Edit Customer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingCustomer(c)}
                      className="h-8 w-8 rounded-lg border border-[#E63946] bg-card text-[#E63946] hover:bg-[#E63946]/10 grid place-items-center transition-colors"
                      title="Delete Customer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {opened && <LedgerDrawer customer={opened} onClose={() => setOpenId(null)} />}
      {adding && (
        <AddCustomerDrawer
          onClose={() => setAdding(false)}
          onAdded={() => qc.invalidateQueries({ queryKey: ["adm-customers"] })}
        />
      )}
      {editingCustomer && (
        <AddCustomerDrawer
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onAdded={() => qc.invalidateQueries({ queryKey: ["adm-customers"] })}
        />
      )}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card w-full max-w-sm rounded-xl p-5 border border-border space-y-4 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-destructive">Delete Customer</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete {deletingCustomer.name}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setDeletingCustomer(null)}
                className="h-9 px-4 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteCustomer.mutate(deletingCustomer.id);
                  setDeletingCustomer(null);
                }}
                className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
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
        message: `${customer.name} paid ${formatRs(amt)}`,
      });
      import("@/lib/push-server").then(({ notifyAdminsPush }) => {
        notifyAdminsPush({
          data: {
            title: "Payment Recorded 💳",
            body: `${customer.name} paid ${formatRs(amt)} (${mode.toUpperCase()})`,
            url: "/admin/customers",
          },
        });
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayOpen(false);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["adm-customers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-md bg-card border-l border-border flex flex-col">
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
            <Stat label="Pending Dues" value={formatRs(totalBilled)} />
            <Stat label="Payments" value={formatRs(totalPaid)} tone="success" />
            <Stat
              label="Balance Due"
              value={balance < 0 ? "Overpaid" : balance === 0 ? "Rs. 0" : formatRs(balance)}
              tone={balance > 0 ? "warning" : "success"}
            />
          </div>
        </div>

        {/* Two Tabs selection */}
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

function Stat({
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

function AddCustomerDrawer({
  customer,
  onClose,
  onAdded,
}: {
  customer?: any;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [price, setPrice] = useState(customer ? String(customer.price_per_bottle) : "25");
  const [route, setRoute] = useState<"A" | "B">(customer?.route ?? "A");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const m = useMutation({
    mutationFn: async () => {
      if (customer) {
        const { error } = await supabase
          .from("customers")
          .update({
            name: name.trim(),
            phone: phone.trim() || null,
            address: address.trim(),
            price_per_bottle: parseFloat(price) || 0,
            route,
          })
          .eq("id", customer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim(),
          price_per_bottle: parseFloat(price) || 0,
          route,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(customer ? "Customer updated successfully" : "Customer added");
      onAdded();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "Customer name is required";
    }
    const pr = parseFloat(price);
    if (isNaN(pr) || pr <= 0) {
      newErrors.price = "Please enter a valid price greater than 0";
    }
    if (!address.trim()) {
      newErrors.address = "Address is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    m.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto h-1.5 w-12 rounded-full bg-muted" />
        <h3 className="font-bold text-lg">{customer ? "Edit Customer" : "Add Customer"}</h3>

        <Field label="Name" error={errors.name}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((errs) => ({ ...errs, name: "" }));
            }}
            className="input"
            autoFocus
          />
        </Field>

        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>

        <Field label="Address" error={errors.address}>
          <input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setErrors((errs) => ({ ...errs, address: "" }));
            }}
            className="input"
          />
        </Field>

        <Field label="Delivery Route">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRoute("A")}
              className={`flex-1 h-11 rounded-[10px] text-sm font-semibold border transition-all ${
                route === "A"
                  ? "bg-[#0077B6] text-white border-[#0077B6]"
                  : "bg-transparent text-muted-foreground border-border"
              }`}
            >
              Route A
            </button>
            <button
              type="button"
              onClick={() => setRoute("B")}
              className={`flex-1 h-11 rounded-[10px] text-sm font-semibold border transition-all ${
                route === "B"
                  ? "bg-[#0077B6] text-white border-[#0077B6]"
                  : "bg-transparent text-muted-foreground border-border"
              }`}
            >
              Route B
            </button>
          </div>
        </Field>

        <Field label="Price per bottle" error={errors.price}>
          <input
            type="number"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setErrors((errs) => ({ ...errs, price: "" }));
            }}
            className="input tabular-nums"
          />
        </Field>

        <button
          onClick={handleSave}
          disabled={m.isPending}
          className="w-full h-12 rounded-[10px] bg-primary text-primary-foreground font-bold disabled:opacity-50 transition-opacity"
        >
          {m.isPending ? "Saving…" : customer ? "Save Changes" : "Add Customer"}
        </button>
      </div>
      <style>{`.input{height:44px;width:100%;padding:0 14px;border-radius:10px;border:1px solid var(--color-border);background:var(--color-background);font-size:14px;outline:none}.input:focus{box-shadow:0 0 0 2px var(--color-ring)}`}</style>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="text-[11px] text-destructive mt-1 font-semibold">{error}</p>}
    </div>
  );
}
