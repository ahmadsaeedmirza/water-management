import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  CreditCard,
  Banknote,
  Globe,
  Clock,
  Truck,
  ChevronDown,
  Search,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { WorkerShell, TopBar } from "@/components/worker-shell";
import { formatRs } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/worker/deliveries")({
  validateSearch: (s: Record<string, unknown>) => ({
    customer_id: typeof s.customer_id === "string" ? s.customer_id : undefined,
    lotId: typeof s.lotId === "string" ? s.lotId : undefined,
  }),
  component: DeliveriesPage,
});

type Mode = "cash" | "card" | "online" | "pending";

function DeliveriesPage() {
  const { user, name } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();

  const [customerType, setCustomerType] = useState<"walkin" | "regular">(
    search.customer_id ? "regular" : "walkin",
  );
  const [customerId, setCustomerId] = useState<string | undefined>(search.customer_id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState("25");
  const [mode, setMode] = useState<Mode>("cash");
  const [searchQuery, setSearchQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeLotQ = useQuery({
    queryKey: ["active-lot", user?.id, search.lotId],
    enabled: !!user,
    queryFn: async () => {
      if (search.lotId) {
        const { data, error } = await supabase
          .from("lots")
          .select("*, deliveries(bottles_delivered)")
          .eq("id", search.lotId)
          .maybeSingle();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("lots")
          .select("*, deliveries(bottles_delivered)")
          .eq("worker_id", user!.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
    },
  });

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("deliveries-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries", filter: `worker_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["active-lot"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const lot = activeLotQ.data;
  const taken = lot?.total_bottles ?? 0;
  const sold = lot?.deliveries?.reduce((a: number, d: any) => a + d.bottles_delivered, 0) ?? 0;
  const stock = taken - sold;
  const selectedCustomer = useMemo(
    () => (customersQ.data ?? []).find((c) => c.id === customerId),
    [customerId, customersQ.data],
  );
  const unitPrice = parseFloat(price) || 0;
  const total = qty * unitPrice;

  useEffect(() => {
    if (customerType === "regular" && selectedCustomer) {
      setPrice(String(selectedCustomer.price_per_bottle ?? 0));
    }
  }, [customerType, selectedCustomer]);

  const record = useMutation({
    mutationFn: async () => {
      if (!lot) throw new Error("No active lot");
      if (qty > stock) throw new Error("Not enough bottles in stock");
      if (customerType === "regular" && !customerId) throw new Error("Select a customer");
      const { error } = await supabase.from("deliveries").insert({
        lot_id: lot.id,
        worker_id: user!.id,
        customer_id: customerType === "regular" ? customerId : null,
        customer_type: customerType,
        bottles_delivered: qty,
        price_per_bottle: unitPrice,
        total_amount: total,
        payment_mode: mode,
      });
      if (error) throw error;
      // auto-complete lot if stock=0
      if (qty >= stock) {
        await supabase
          .from("lots")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", lot.id);
      }
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.user_id,
            kind: "delivery",
            message: `${name || "Worker"} delivered ${qty} bottle${qty > 1 ? "s" : ""} · ${formatRs(total)} · ${mode}`,
          })),
        );
        import("@/lib/push-server").then(({ notifyAdminsPush }) => {
          notifyAdminsPush({
            data: {
              title: "New Delivery Recorded 🚚",
              body: `${name || "Worker"} delivered ${qty} bottle${qty > 1 ? "s" : ""} · ${formatRs(total)} · ${mode.toUpperCase()}`,
              url: "/admin/dashboard",
            },
          });
        });
      }
      // self confirmation
      await supabase.from("notifications").insert({
        user_id: user!.id,
        kind: "delivery_self",
        message: `Delivery recorded — ${qty} bottle${qty > 1 ? "s" : ""} · ${formatRs(total)} · ${mode}`,
      });
    },
    onSuccess: () => {
      toast.success("Delivery recorded");
      qc.invalidateQueries({ queryKey: ["active-lot"] });
      qc.invalidateQueries({ queryKey: ["lots"] });
      setQty(1);
      setErrors({});
      if (customerType === "walkin") setMode("cash");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to record delivery"),
  });

  const handleRecord = () => {
    const newErrors: Record<string, string> = {};
    if (!lot) {
      newErrors.lot = "No active lot. Start a lot first.";
    } else {
      if (!qty || qty <= 0 || isNaN(qty)) {
        newErrors.qty = "Quantity must be 1 or more";
      } else if (qty > stock) {
        newErrors.qty = `Only ${stock} bottles remaining in stock`;
      }
    }
    if (customerType === "regular" && !customerId) {
      newErrors.customerId = "Please select a regular customer";
    }
    const up = parseFloat(price);
    if (isNaN(up) || up <= 0) {
      newErrors.price = "Please enter a valid unit price";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    record.mutate();
  };

  const filteredCustomers = useMemo(() => {
    const all = customersQ.data ?? [];
    if (!searchQuery) return all;
    const term = searchQuery.toLowerCase();
    return all.filter(
      (c) => c.name.toLowerCase().includes(term) || c.address.toLowerCase().includes(term),
    );
  }, [customersQ.data, searchQuery]);

  return (
    <WorkerShell>
      <TopBar title="Log Delivery" subtitle="Record a new order" />
      <div className="px-5 py-5 space-y-5">
        {activeLotQ.isLoading ? (
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
        ) : !lot ? (
          <div className="card-surface p-6 text-center">
            <Truck className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="mt-3 font-semibold">No active lot</p>
            <p className="text-sm text-muted-foreground">Start a new lot from the home screen.</p>
          </div>
        ) : (
          <>
            <div className="card-surface p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-accent grid place-items-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Lot</p>
                  <p className="font-bold">#{lot.id.slice(0, 6).toUpperCase()}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 divide-x divide-border text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Taken</p>
                  <p className="font-bold text-primary">{taken}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sold</p>
                  <p className="font-bold text-success">{sold}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stock</p>
                  <p className="font-bold text-warning">{stock}</p>
                </div>
              </div>
            </div>

            <div className="card-surface p-5 space-y-5">
              <Field label="CUSTOMER TYPE">
                <div className="grid grid-cols-2 p-1 rounded-xl bg-muted">
                  {(["walkin", "regular"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setCustomerType(t);
                        if (t === "walkin") {
                          setCustomerId(undefined);
                          setMode("cash");
                        }
                        setErrors({});
                      }}
                      className={`h-10 rounded-lg text-sm font-semibold transition-colors ${customerType === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                    >
                      {t === "walkin" ? "Walk-in" : "Regular"}
                    </button>
                  ))}
                </div>
              </Field>

              {customerType === "regular" && (
                <Field label="CUSTOMER" error={errors.customerId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setPickerOpen(true);
                    }}
                    className="h-12 w-full rounded-lg border border-border bg-card px-3 text-left text-sm flex items-center justify-between"
                  >
                    <span
                      className={selectedCustomer ? "text-foreground" : "text-muted-foreground"}
                    >
                      {selectedCustomer ? selectedCustomer.name : "Select customer"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="BOTTLES DELIVERED" error={errors.qty}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={qty || ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setQty(isNaN(v) ? 0 : v);
                      setErrors((errs) => ({ ...errs, qty: "" }));
                    }}
                    placeholder="e.g. 5"
                    className="h-12 w-full rounded-lg border border-border bg-card px-3 font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                </Field>
                <Field label="UNIT PRICE (Rs.)" error={errors.price}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      setErrors((errs) => ({ ...errs, price: "" }));
                    }}
                    className="h-12 w-full rounded-lg border border-border bg-card px-3 text-center font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                </Field>
              </div>

              <div className="bg-accent/50 rounded-xl p-4 flex items-center justify-between">
                <p className="font-medium">Order Total</p>
                <p className="text-2xl font-bold text-primary">{formatRs(total)}</p>
              </div>

              <Field label="PAYMENT METHOD">
                <div className="grid grid-cols-2 gap-2">
                  <PayPill
                    icon={Banknote}
                    label="Cash"
                    value="cash"
                    current={mode}
                    onClick={setMode}
                  />
                  <PayPill
                    icon={CreditCard}
                    label="Card"
                    value="card"
                    current={mode}
                    onClick={setMode}
                  />
                  <PayPill
                    icon={Globe}
                    label="Online"
                    value="online"
                    current={mode}
                    onClick={setMode}
                  />
                  {customerType === "regular" && (
                    <PayPill
                      icon={Clock}
                      label="Pending"
                      value="pending"
                      current={mode}
                      onClick={setMode}
                    />
                  )}
                </div>
              </Field>

              <button
                onClick={handleRecord}
                disabled={record.isPending || stock <= 0}
                className="h-12 w-full rounded-[10px] bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 transition-opacity"
              >
                {record.isPending ? "Recording..." : "Record Delivery"}
              </button>
            </div>
          </>
        )}
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPickerOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-card rounded-t-[20px] mx-auto max-w-[390px] p-5 max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border shrink-0" />
            <h3 className="text-lg font-bold mb-3 shrink-0">Select Customer</h3>

            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer..."
                className="w-full h-11 pl-9 pr-3 rounded-[10px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredCustomers.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No customers found.
                </p>
              )}
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCustomerId(c.id);
                    setPickerOpen(false);
                    setErrors((errs) => ({ ...errs, customerId: "" }));
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/30"
                >
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.address}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </WorkerShell>
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
      <p className="text-xs font-bold tracking-wider text-muted-foreground mb-2">{label}</p>
      {children}
      {error && <p className="text-xs text-destructive mt-1 font-semibold">{error}</p>}
    </div>
  );
}

function PayPill({
  icon: Icon,
  label,
  value,
  current,
  onClick,
}: {
  icon: any;
  label: string;
  value: Mode;
  current: Mode;
  onClick: (m: Mode) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`h-11 rounded-full border text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
        active
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-card border-border text-muted-foreground hover:bg-muted/50"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
