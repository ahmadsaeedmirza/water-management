import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/lib/auth";
import { formatRs, formatDate, formatTime, relativeTime, initials } from "@/lib/format";
import {
  Droplet,
  DollarSign,
  Wallet,
  TrendingDown,
  Activity,
  X,
  Banknote,
  CreditCard,
  Globe,
  Phone,
  MapPin,
  Plus,
  Truck,
  Receipt,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: AdminDashboard,
});

type Range = "today" | "month";

function startOf(range: Range) {
  const d = new Date();
  if (range === "today") {
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

function AdminDashboard() {
  const [range, setRange] = useState<Range>("today");
  const [chartMode, setChartMode] = useState<"bottles" | "revenue">("bottles");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string | null>(null);
  const qc = useQueryClient();
  const since = startOf(range);

  const deliveriesQ = useQuery({
    queryKey: ["adm-deliveries", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(
          "id, bottles_delivered, total_amount, payment_mode, created_at, customer_id, customer_type, customers(name)",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const expensesQ = useQuery({
    queryKey: ["adm-expenses", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("name, amount, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const paymentsQ = useQuery({
    queryKey: ["adm-payments", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("amount, created_at")
        .gte("created_at", since);
      if (error) throw error;
      return data ?? [];
    },
  });

  const recentExpensesQ = useQuery({
    queryKey: ["recent-expenses-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const customersSummaryQ = useQuery({
    queryKey: ["adm-customers-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(
          `
          id, name, address, phone, price_per_bottle,
          deliveries(bottles_delivered, total_amount, payment_mode, created_at),
          payments(amount, created_at)
        `,
        )
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 7-day chart range (always)
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    return d;
  }, []);

  const weekQ = useQuery({
    queryKey: ["adm-week"],
    queryFn: async () => {
      const [d, p] = await Promise.all([
        supabase
          .from("deliveries")
          .select("bottles_delivered, total_amount, payment_mode, created_at, customer_type")
          .gte("created_at", weekStart.toISOString()),
        supabase
          .from("payments")
          .select("amount, created_at")
          .gte("created_at", weekStart.toISOString()),
      ]);
      if (d.error) throw d.error;
      if (p.error) throw p.error;
      return { deliveries: d.data ?? [], payments: p.data ?? [] };
    },
  });

  // Specific day breakdown modal query
  const breakdownQ = useQuery({
    queryKey: ["breakdown", selectedDate],
    enabled: !!selectedDate,
    queryFn: async () => {
      const start = new Date(selectedDate + "T00:00:00").toISOString();
      const end = new Date(selectedDate + "T23:59:59").toISOString();
      const [lots, deliveries, expenses, payments] = await Promise.all([
        supabase
          .from("lots")
          .select("*")
          .gte("created_at", start)
          .lte("created_at", end),
        supabase
          .from("deliveries")
          .select("*, customers(name)")
          .gte("created_at", start)
          .lte("created_at", end),
        supabase
          .from("expenses")
          .select("*")
          .gte("created_at", start)
          .lte("created_at", end),
        supabase
          .from("payments")
          .select("*, customers(name)")
          .gte("created_at", start)
          .lte("created_at", end),
      ]);
      return {
        lots: lots.data ?? [],
        deliveries: deliveries.data ?? [],
        expenses: expenses.data ?? [],
        payments: payments.data ?? [],
      };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("adm-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        qc.invalidateQueries({ queryKey: ["adm-deliveries"] });
        qc.invalidateQueries({ queryKey: ["adm-week"] });
        qc.invalidateQueries({ queryKey: ["adm-customers-summary"] });
        if (selectedDate) qc.invalidateQueries({ queryKey: ["breakdown", selectedDate] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        qc.invalidateQueries({ queryKey: ["adm-expenses"] });
        qc.invalidateQueries({ queryKey: ["recent-expenses-dashboard"] });
        if (selectedDate) qc.invalidateQueries({ queryKey: ["breakdown", selectedDate] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        qc.invalidateQueries({ queryKey: ["adm-payments"] });
        qc.invalidateQueries({ queryKey: ["adm-customers-summary"] });
        if (selectedDate) qc.invalidateQueries({ queryKey: ["breakdown", selectedDate] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, selectedDate]);

  const deliveries = deliveriesQ.data ?? [];
  const bottles = deliveries.reduce((a, d) => a + d.bottles_delivered, 0);

  // Walk-in Revenue = SUM(deliveries where customer_type = 'walkin' AND payment_mode != 'pending')
  const walkinRev = deliveries
    .filter((d) => d.customer_type === "walkin" && d.payment_mode !== "pending")
    .reduce((a, d) => a + Number(d.total_amount), 0);

  // Regular Customer Collected Revenue = SUM(payments)
  const regularCollected = (paymentsQ.data ?? []).reduce((a, p) => a + Number(p.amount), 0);

  // Total Revenue = Walk-in Revenue + Regular Customer Collected Revenue
  const sales = walkinRev + regularCollected;
  const expenses = (expensesQ.data ?? []).reduce((a, e) => a + Number(e.amount), 0);
  const net = sales - expenses;

  // Pending Collection = SUM(deliveries where customer_type = 'regular' AND payment_mode = 'pending') - SUM(payments)
  const regPendingBilled = deliveries
    .filter((d) => d.customer_type === "regular" && d.payment_mode === "pending")
    .reduce((a, d) => a + Number(d.total_amount), 0);
  const pendingCollection = Math.max(0, regPendingBilled - regularCollected);

  const chartData = useMemo(() => {
    const days: { label: string; date: string; bottles: number; sales: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.toISOString().slice(0, 10),
        bottles: 0,
        sales: 0,
      });
    }
    const data = weekQ.data ?? { deliveries: [], payments: [] };
    for (const row of data.deliveries) {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      const cell = days.find((x) => x.date === key);
      if (cell) {
        cell.bottles += row.bottles_delivered;
        if (row.customer_type === "walkin" && row.payment_mode !== "pending") {
          cell.sales += Number(row.total_amount);
        }
      }
    }
    for (const row of data.payments) {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      const cell = days.find((x) => x.date === key);
      if (cell) {
        cell.sales += Number(row.amount);
      }
    }
    return days;
  }, [weekQ.data, weekStart]);

  const selectedCustomer = useMemo(() => {
    return (customersSummaryQ.data ?? []).find((c) => c.id === ledgerCustomerId);
  }, [ledgerCustomerId, customersSummaryQ.data]);

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Live overview of your business"
      right={
        <div className="hidden sm:inline-flex rounded-[10px] bg-muted p-1">
          {(["today", "month"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 h-9 rounded-[8px] text-sm font-semibold capitalize transition-colors ${range === r ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
            >
              {r === "today" ? "Today" : "This Month"}
            </button>
          ))}
        </div>
      }
    >
      <div className="sm:hidden mb-5 inline-flex rounded-[10px] bg-muted p-1">
        {(["today", "month"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 h-9 rounded-[8px] text-sm font-semibold capitalize ${range === r ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
          >
            {r === "today" ? "Today" : "This Month"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi
          icon={Droplet}
          tint="bg-accent text-primary"
          label="Total Bottles Sold"
          value={bottles.toString()}
        />
        <Kpi
          icon={DollarSign}
          tint="bg-success/10 text-success"
          label="Total Revenue"
          value={formatRs(sales)}
        />
        <Kpi
          icon={TrendingDown}
          tint="bg-destructive/10 text-destructive"
          label="Total Expenses"
          value={formatRs(expenses)}
        />
        <Kpi
          icon={Wallet}
          tint={net < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}
          label="Net Revenue"
          value={formatRs(net)}
          negative={net < 0}
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold text-muted-foreground">
        <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Walk-in Revenue: <span className="text-foreground">{formatRs(walkinRev)}</span>
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Pending Collection: <span className="text-foreground">{formatRs(pendingCollection)}</span>
        </span>
      </div>

      <div className="card-surface p-5 mt-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold">Last 7 Days</h3>
            <p className="text-xs text-muted-foreground">
              {chartMode === "bottles" ? "Bottles delivered per day" : "Revenue collected per day"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="inline-flex rounded-[8px] bg-muted p-0.5">
              {(["bottles", "revenue"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={`px-3 py-1 rounded-[6px] text-xs font-semibold capitalize transition-colors ${chartMode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Net ({range === "today" ? "Today" : "Month"})
              </p>
              <p
                className={`font-bold tabular-nums ${net >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatRs(net)}
              </p>
            </div>
          </div>
        </div>
        <div className="h-64 -mx-2 cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              onClick={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  setSelectedDate(state.activePayload[0].payload.date);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid var(--color-border)",
                  fontSize: 12,
                }}
                formatter={(v: number, n) => [
                  chartMode === "revenue" ? formatRs(v) : v,
                  chartMode === "revenue" ? "Sales" : "Bottles",
                ]}
              />
              <Bar dataKey={chartMode === "bottles" ? "bottles" : "sales"} radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => {
                  const isToday = entry.date === new Date().toISOString().slice(0, 10);
                  return <Cell key={`cell-${index}`} fill={isToday ? "#00B4D8" : "#0077B6"} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        {/* Recent Deliveries Column */}
        <div className="card-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-bold">Recent Deliveries</h3>
          </div>
          {deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
              <Truck className="h-12 w-12 text-[#90E0EF]" />
              <p className="text-[#64748B] text-sm font-medium">No deliveries today</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {deliveries.slice(0, 10).map((d: any) => (
                <li key={d.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {d.customers?.name ?? "Walk-in"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.bottles_delivered} bottle(s) · {formatTime(d.created_at)} ·{" "}
                      {relativeTime(d.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold tabular-nums text-sm">{formatRs(d.total_amount)}</p>
                    <p
                      className={`text-[10px] font-semibold uppercase ${d.payment_mode === "pending" ? "text-warning" : "text-success"}`}
                    >
                      {d.payment_mode}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Expenses Column */}
        <div className="card-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <h3 className="font-bold">Recent Expenses</h3>
          </div>
          {recentExpensesQ.isLoading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground animate-pulse">
              Loading...
            </div>
          ) : (recentExpensesQ.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
              <Receipt className="h-12 w-12 text-[#90E0EF]" />
              <p className="text-[#64748B] text-sm font-medium">No expenses today</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(recentExpensesQ.data ?? []).slice(0, 10).map((e: any) => (
                <li key={e.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.created_at)} · {formatTime(e.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold tabular-nums text-sm text-destructive">
                      {formatRs(e.amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Regular Customers Summary Table */}
      <div className="card-surface mt-5 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold">Regular Customers Summary</h3>
        </div>
        {customersSummaryQ.isLoading ? (
          <div className="p-5 text-center text-sm text-muted-foreground animate-pulse">
            Loading customers summary...
          </div>
        ) : (customersSummaryQ.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
            <Users className="h-12 w-12 text-[#90E0EF]" />
            <p className="text-[#64748B] text-sm font-medium">No regular customers yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4 text-center">Bottles This Month</th>
                  <th className="p-4 text-center">Balance Due</th>
                  <th className="p-4">Last Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(customersSummaryQ.data ?? []).map((c: any) => {
                  const startOfMonth = new Date();
                  startOfMonth.setDate(1);
                  startOfMonth.setHours(0, 0, 0, 0);
                  const bottlesThisMonth = (c.deliveries ?? [])
                    .filter((d: any) => new Date(d.created_at) >= startOfMonth)
                    .reduce((sum: number, d: any) => sum + d.bottles_delivered, 0);

                  const pendingSum = (c.deliveries ?? []).filter((d: any) => d.payment_mode === "pending").reduce((a: number, d: any) => a + Number(d.total_amount), 0);
                  const paymentsSum = (c.payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
                  const dues = pendingSum - paymentsSum;

                  const lastDel = (c.deliveries ?? []).sort(
                    (a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at),
                  )[0];
                  const lastDelDate = lastDel ? formatDate(lastDel.created_at) : "Never";

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setLedgerCustomerId(c.id)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-semibold text-primary">{c.name}</td>
                      <td className="p-4 text-center font-medium tabular-nums">
                        {bottlesThisMonth}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            dues > 0 ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                          }`}
                        >
                          {dues < 0 ? "Overpaid" : dues === 0 ? "Cleared" : formatRs(dues)}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">{lastDelDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bar breakdown details modal/panel */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedDate(null)} />
          <div className="relative w-full max-w-md h-full bg-card border-l border-border p-5 flex flex-col animate-in slide-in-from-right duration-250">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <h2 className="font-bold text-lg">Daily Breakdown</h2>
                <p className="text-xs text-muted-foreground">{formatDate(selectedDate)}</p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="h-9 w-9 rounded-[10px] grid place-items-center hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {breakdownQ.isLoading ? (
              <div className="flex-1 space-y-3 animate-pulse">
                <div className="h-20 bg-muted rounded-xl" />
                <div className="h-24 bg-muted rounded-xl" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {/* Daily Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="card-surface p-3 bg-muted/20">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Revenue
                    </p>
                    <p className="text-lg font-bold tabular-nums text-success">
                      {formatRs(
                        (breakdownQ.data?.deliveries ?? [])
                          .filter(
                            (d: any) =>
                              d.customer_type === "walkin" &&
                              d.payment_mode !== "pending",
                          )
                          .reduce((a: number, d: any) => a + Number(d.total_amount), 0) +
                          (breakdownQ.data?.payments ?? []).reduce(
                            (a: number, p: any) => a + Number(p.amount),
                            0,
                          ),
                      )}
                    </p>
                  </div>
                  <div className="card-surface p-3 bg-muted/20">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Expenses
                    </p>
                    <p className="text-lg font-bold tabular-nums text-destructive">
                      {formatRs(
                        (breakdownQ.data?.expenses ?? []).reduce(
                          (a: number, e: any) => a + Number(e.amount),
                          0,
                        ),
                      )}
                    </p>
                  </div>
                </div>

                {/* Lots section */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Lots Loaded
                  </h4>
                  {(breakdownQ.data?.lots ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 italic">No lots loaded.</p>
                  ) : (
                    <div className="space-y-2">
                      {(breakdownQ.data?.lots ?? []).map((l: any) => {
                        const sold = (breakdownQ.data?.deliveries ?? [])
                          .filter((d: any) => d.lot_id === l.id)
                          .reduce((a: number, d: any) => a + d.bottles_delivered, 0);
                        return (
                          <div key={l.id} className="card-surface p-3 text-xs flex justify-between">
                            <div>
                              <p className="font-semibold">Lot #{l.id.slice(0, 6).toUpperCase()}</p>
                              <p className="text-muted-foreground mt-0.5">
                                Taken: {l.total_bottles} · Sold: {sold}
                              </p>
                            </div>
                            <span className="font-bold text-primary">
                              {l.total_bottles - sold} left
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Deliveries section */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Deliveries
                  </h4>
                  {(breakdownQ.data?.deliveries ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 italic">
                      No deliveries recorded.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(breakdownQ.data?.deliveries ?? []).map((d: any) => (
                        <div
                          key={d.id}
                          className="card-surface p-3 text-xs flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold">{d.customers?.name ?? "Walk-in"}</p>
                            <p className="text-muted-foreground mt-0.5">
                              {d.bottles_delivered} bottle(s) · {formatTime(d.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold tabular-nums">{formatRs(d.total_amount)}</p>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">
                              {d.payment_mode}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments Received section */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Payments Received
                  </h4>
                  {(breakdownQ.data?.payments ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 italic">
                      No payments recorded.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(breakdownQ.data?.payments ?? []).map((p: any) => (
                        <div
                          key={p.id}
                          className="card-surface p-3 text-xs flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold">
                              {p.customers?.name || "Regular Customer"}
                            </p>
                            <p className="text-muted-foreground mt-0.5">
                              {formatTime(p.created_at)}
                            </p>
                          </div>
                          <span className="font-bold text-success tabular-nums">
                            {formatRs(p.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expenses section */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Expenses
                  </h4>
                  {(breakdownQ.data?.expenses ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 italic">
                      No expenses recorded.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(breakdownQ.data?.expenses ?? []).map((e: any) => (
                        <div
                          key={e.id}
                          className="card-surface p-3 text-xs flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold">{e.name}</p>
                            <p className="text-muted-foreground mt-0.5">
                              {formatTime(e.created_at)}
                            </p>
                          </div>
                          <span className="font-bold text-destructive tabular-nums">
                            {formatRs(e.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ledger Drawer */}
      {selectedCustomer && (
        <LedgerDrawer customer={selectedCustomer} onClose={() => setLedgerCustomerId(null)} />
      )}
    </AdminShell>
  );
}

function Kpi({
  icon: Icon,
  tint,
  label,
  value,
  negative,
}: {
  icon: any;
  tint: string;
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="card-surface p-4">
      <div className={`h-10 w-10 rounded-[10px] grid place-items-center ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-xl md:text-2xl font-bold tabular-nums truncate ${negative ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

// Reusable Ledger Drawer copied from admin customers route for seamless integration
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
            url: "/admin/dashboard",
          },
        });
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayOpen(false);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["adm-customers-summary"] });
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
            <h2 className="font-bold truncate">{customer.name}</h2>
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
            className="absolute inset-0 z-10 flex items-end bg-black/40 animate-in fade-in duration-200"
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
