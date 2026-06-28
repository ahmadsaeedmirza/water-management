import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { formatRs, formatDate, formatTime } from "@/lib/format";
import { Printer, Calendar, FileText, Droplet, Download } from "lucide-react";
import { generateReportPDF } from "@/lib/pdf-generator";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/bills")({
  component: AdminBills,
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function AdminBills() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(todayStr());
  const [customerId, setCustomerId] = useState<string>("all");
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState(todayStr());
  const [downloadingDaily, setDownloadingDaily] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const customersQ = useQuery({
    queryKey: ["bills-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const customers = customersQ.data ?? [];

  // Automatically default based on the URL search query parameters (Bills vs Reports)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "reports") {
      setCustomerId("all");
    } else if (tab === "bills" && customerId === "all" && customers.length > 0) {
      setCustomerId(customers[0].id);
    }
  }, [customers]);

  const fromIso = useMemo(() => new Date(from + "T00:00:00").toISOString(), [from]);
  const toIso = useMemo(() => new Date(to + "T23:59:59").toISOString(), [to]);

  const earliestDeliveryQ = useQuery({
    queryKey: ["earliest-delivery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("created_at")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dataQ = useQuery({
    queryKey: ["bills", from, to, customerId],
    queryFn: async () => {
      let dq = supabase
        .from("deliveries")
        .select(
          "id, bottles_delivered, total_amount, payment_mode, created_at, customer_id, customer_type, customers(name)",
        )
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (customerId !== "all") dq = dq.eq("customer_id", customerId);
      const [d, p, e] = await Promise.all([
        dq,
        customerId !== "all"
          ? supabase
              .from("payments")
              .select("amount, payment_mode, created_at, customer_id, customers(name)")
              .eq("customer_id", customerId)
              .gte("created_at", fromIso)
              .lte("created_at", toIso)
          : supabase
              .from("payments")
              .select("amount, payment_mode, created_at, customer_id, customers(name)")
              .gte("created_at", fromIso)
              .lte("created_at", toIso),
        supabase
          .from("expenses")
          .select("name, amount, created_at")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
      ]);
      if (d.error) throw d.error;
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      return { deliveries: d.data ?? [], payments: p.data ?? [], expenses: e.data ?? [] };
    },
  });

  const data = dataQ.data ?? { deliveries: [], payments: [], expenses: [] };
  
  const totals = useMemo(() => {
    const bottles = data.deliveries.reduce((a, d: any) => a + d.bottles_delivered, 0);
    
    // Walk-in Revenue = SUM(deliveries where customer_type = 'walkin' AND payment_mode != 'pending')
    const walkinRev = data.deliveries
      .filter((d: any) => d.customer_type === "walkin" && d.payment_mode !== "pending")
      .reduce((a, d: any) => a + Number(d.total_amount), 0);

    // Regular Customer Collected Revenue = SUM(payments)
    const regularCollected = data.payments.reduce((a, p: any) => a + Number(p.amount), 0);

    // Total Revenue = Walk-in Revenue + Regular Customer Collected Revenue
    const sales = walkinRev + regularCollected;
    const expenses = data.expenses.reduce((a, e: any) => a + Number(e.amount), 0);
    const payments = regularCollected;
    
    // Pending Collection
    const regPendingBilled = data.deliveries
      .filter((d: any) => d.customer_type === "regular" && d.payment_mode === "pending")
      .reduce((a, d: any) => a + Number(d.total_amount), 0);
    const pending = Math.max(0, regPendingBilled - regularCollected);
    
    return { bottles, sales, expenses, payments, pending, net: sales - expenses };
  }, [data]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const title =
    customerId === "all" ? "Business Report" : `Statement · ${selectedCustomer?.name ?? ""}`;

  const setPreset = (preset: "today" | "week" | "month") => {
    const t = new Date();
    if (preset === "today") {
      const s = t.toISOString().slice(0, 10);
      setFrom(s);
      setTo(s);
    } else if (preset === "week") {
      const f = new Date();
      f.setDate(f.getDate() - 6);
      setFrom(f.toISOString().slice(0, 10));
      setTo(t.toISOString().slice(0, 10));
    } else {
      const f = new Date();
      f.setDate(1);
      setFrom(f.toISOString().slice(0, 10));
      setTo(t.toISOString().slice(0, 10));
    }
  };

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let startYear = currentYear;
    if (earliestDeliveryQ.data?.created_at) {
      startYear = new Date(earliestDeliveryQ.data.created_at).getFullYear();
    }
    const years = [];
    for (let y = currentYear; y >= startYear; y--) {
      years.push(y);
    }
    return years;
  }, [earliestDeliveryQ.data]);

  const availableMonthsQ = useQuery({
    queryKey: ["available-months-by-year", selectedYear],
    queryFn: async () => {
      const start = new Date(selectedYear, 0, 1).toISOString();
      const end = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();
      
      const { data, error } = await supabase
        .from("deliveries")
        .select("created_at")
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      
      const monthsSet = new Set<number>();
      for (const d of data ?? []) {
        monthsSet.add(new Date(d.created_at).getMonth());
      }
      return Array.from(monthsSet).sort((a, b) => b - a);
    },
  });

  const activeMonthCards = useMemo(() => {
    const list = [];
    const months = availableMonthsQ.data ?? [];
    for (const m of months) {
      const d = new Date(selectedYear, m, 1);
      list.push({
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        month: m,
        year: selectedYear,
        from: new Date(selectedYear, m, 1).toISOString().slice(0, 10),
        to: new Date(selectedYear, m + 1, 0).toISOString().slice(0, 10),
      });
    }
    return list;
  }, [availableMonthsQ.data, selectedYear]);

  const handleDownloadMonth = async (mPreset: (typeof activeMonthCards)[0]) => {
    setDownloadingMonth(mPreset.label);
    try {
      const fromIso = new Date(mPreset.from + "T00:00:00").toISOString();
      const toIso = new Date(mPreset.to + "T23:59:59").toISOString();

      const [d, p, e] = await Promise.all([
        supabase
          .from("deliveries")
          .select("*, customers(name)")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
        supabase
          .from("payments")
          .select("*, customers(name)")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
        supabase
          .from("expenses")
          .select("*")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
      ]);

      const deliveries = d.data ?? [];
      const payments = p.data ?? [];
      const expenses = e.data ?? [];

      const bottles = deliveries.reduce((a, x) => a + x.bottles_delivered, 0);
      
      const fromDeliveries = deliveries
        .filter((x) => x.payment_mode !== "pending")
        .reduce((a, x) => a + Number(x.total_amount), 0);
      const fromPayments = payments.reduce((a, x) => a + Number(x.amount), 0);
      const sales = fromDeliveries + fromPayments;

      const expTotal = expenses.reduce((a, x) => a + Number(x.amount), 0);
      const payTotal = fromPayments;
      
      const pendingSum = deliveries
        .filter((x) => x.payment_mode === "pending")
        .reduce((a, x) => a + Number(x.total_amount), 0);
      const pending = Math.max(0, pendingSum - payTotal);

      generateReportPDF({
        title: `Monthly Business Report - ${mPreset.label}`,
        subtitle: "Pure Water Delivery",
        dateRange: `${formatDate(mPreset.from)} - ${formatDate(mPreset.to)}`,
        generatedAt: `${formatDate(new Date())} ${formatTime(new Date())}`,
        totals: {
          bottles,
          sales,
          payments: payTotal,
          expenses: expTotal,
          pending,
          net: sales - expTotal,
        },
        deliveries,
        payments,
        expenses,
        customerId: "all",
      });
      toast.success(`Downloaded report for ${mPreset.label}`);
    } catch (err: any) {
      toast.error(`Failed to generate monthly report: ${err.message}`);
    } finally {
      setDownloadingMonth(null);
    }
  };

  const handleDownloadDaily = async () => {
    setDownloadingDaily(true);
    try {
      const fromIso = new Date(dailyDate + "T00:00:00").toISOString();
      const toIso = new Date(dailyDate + "T23:59:59").toISOString();

      const [d, p, e] = await Promise.all([
        supabase
          .from("deliveries")
          .select("*, customers(name)")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
        supabase
          .from("payments")
          .select("*, customers(name)")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
        supabase
          .from("expenses")
          .select("*")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
      ]);

      const deliveries = d.data ?? [];
      const payments = p.data ?? [];
      const expenses = e.data ?? [];

      const bottles = deliveries.reduce((a, x) => a + x.bottles_delivered, 0);
      
      const fromDeliveries = deliveries
        .filter((x) => x.payment_mode !== "pending")
        .reduce((a, x) => a + Number(x.total_amount), 0);
      const fromPayments = payments.reduce((a, x) => a + Number(x.amount), 0);
      const sales = fromDeliveries + fromPayments;

      const expTotal = expenses.reduce((a, x) => a + Number(x.amount), 0);
      const payTotal = fromPayments;

      const pendingSum = deliveries
        .filter((x) => x.payment_mode === "pending")
        .reduce((a, x) => a + Number(x.total_amount), 0);
      const pending = Math.max(0, pendingSum - payTotal);

      generateReportPDF({
        title: `Daily Operational Report - ${formatDate(dailyDate)}`,
        subtitle: "Pure Water Operations",
        dateRange: formatDate(dailyDate),
        generatedAt: `${formatDate(new Date())} ${formatTime(new Date())}`,
        totals: {
          bottles,
          sales,
          payments: payTotal,
          expenses: expTotal,
          pending,
          net: sales - expTotal,
        },
        deliveries,
        payments,
        expenses,
        customerId: "all",
      });
      toast.success(`Downloaded daily report for ${formatDate(dailyDate)}`);
    } catch (err: any) {
      toast.error(`Failed to generate daily report: ${err.message}`);
    } finally {
      setDownloadingDaily(false);
    }
  };

  return (
    <AdminShell
      title="Bills & Reports"
      subtitle="Generate printable reports and customer statements"
      right={
        <div className="flex gap-2">
          <button
            onClick={() => {
              generateReportPDF({
                title: title,
                subtitle: "Pure Water Delivery",
                dateRange: `${formatDate(from)} - ${formatDate(to)}`,
                generatedAt: `${formatDate(new Date())} ${formatTime(new Date())}`,
                totals: totals,
                deliveries: data.deliveries,
                payments: data.payments,
                expenses: data.expenses,
                customerId: customerId,
              });
            }}
            className="h-10 px-4 rounded-[10px] bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95"
          >
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="h-10 px-4 rounded-[10px] border border-border bg-card text-foreground text-sm font-semibold inline-flex items-center gap-2 hover:bg-muted"
          >
            <Printer className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">Print / Save PDF</span>
          </button>
        </div>
      }
    >
      <div className="card-surface p-4 md:p-5 mb-5 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase">From</label>
            <div className="mt-1 relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-11 pl-9 pr-3 rounded-[10px] border border-border bg-card text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase">To</label>
            <div className="mt-1 relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-11 pl-9 pr-3 rounded-[10px] border border-border bg-card text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-muted-foreground uppercase">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full h-11 px-3 rounded-[10px] border border-border bg-card text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All customers (business report)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {(["today", "week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className="h-11 px-3 rounded-[10px] border border-border bg-card text-xs font-semibold capitalize hover:bg-muted"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Printable Report */}
      <div
        id="report"
        className="card-surface p-6 md:p-8 print:shadow-none print:border-0 print:p-0"
      >
        <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary grid place-items-center">
              <Droplet className="h-6 w-6 text-primary-foreground" fill="currentColor" />
            </div>
            <div>
              <p className="font-bold text-lg">Shifaf Aab</p>
              <p className="text-xs text-muted-foreground">Pure Water Delivery</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold">{title}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(from)} – {formatDate(to)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Generated {formatDate(new Date())} {formatTime(new Date())}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Sum label="Bottles" value={totals.bottles.toString()} />
          <Sum label="Sales" value={formatRs(totals.sales)} />
          <Sum label="Payments In" value={formatRs(totals.payments)} tone="success" />
          {customerId === "all" ? (
            <Sum label="Expenses" value={formatRs(totals.expenses)} tone="destructive" />
          ) : (
            <Sum label="Pending" value={formatRs(totals.pending)} tone="warning" />
          )}
        </div>

        <Section
          title={customerId === "all" ? "Deliveries" : "Deliveries to this customer"}
          count={data.deliveries.length}
        >
          {data.deliveries.length === 0 ? (
            <Empty />
          ) : (
            <Table head={["Date", "Customer", "Bottles", "Method", "Amount"]}>
              {data.deliveries.map((d: any) => (
                <tr key={d.id} className="border-t border-border">
                  <Td>{formatDate(d.created_at)}</Td>
                  <Td>{d.customers?.name ?? "Walk-in"}</Td>
                  <Td className="tabular-nums">{d.bottles_delivered}</Td>
                  <Td className="capitalize">{d.payment_mode}</Td>
                  <Td className="tabular-nums text-right font-semibold">
                    {formatRs(d.total_amount)}
                  </Td>
                </tr>
              ))}
              <tr className="border-t-2 border-foreground/20 bg-muted/40 font-bold">
                <Td colSpan={2}>Total</Td>
                <Td className="tabular-nums">{totals.bottles}</Td>
                <Td></Td>
                <Td className="tabular-nums text-right">{formatRs(totals.sales)}</Td>
              </tr>
            </Table>
          )}
        </Section>

        <Section title="Payments" count={data.payments.length}>
          {data.payments.length === 0 ? (
            <Empty />
          ) : (
            <Table head={["Date", "Method", "Amount"]}>
              {data.payments.map((p: any, i) => (
                <tr key={i} className="border-t border-border">
                  <Td>{formatDate(p.created_at)}</Td>
                  <Td className="capitalize">{p.payment_mode}</Td>
                  <Td className="tabular-nums text-right font-semibold text-success">
                    {formatRs(p.amount)}
                  </Td>
                </tr>
              ))}
              <tr className="border-t-2 border-foreground/20 bg-muted/40 font-bold">
                <Td colSpan={2}>Total</Td>
                <Td className="tabular-nums text-right">{formatRs(totals.payments)}</Td>
              </tr>
            </Table>
          )}
        </Section>

        {customerId === "all" && (
          <Section title="Expenses" count={data.expenses.length}>
            {data.expenses.length === 0 ? (
              <Empty />
            ) : (
              <Table head={["Date", "Description", "Amount"]}>
                {data.expenses.map((e: any, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{formatDate(e.created_at)}</Td>
                    <Td>{e.name}</Td>
                    <Td className="tabular-nums text-right font-semibold text-destructive">
                      {formatRs(e.amount)}
                    </Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-foreground/20 bg-muted/40 font-bold">
                  <Td colSpan={2}>Total</Td>
                  <Td className="tabular-nums text-right">{formatRs(totals.expenses)}</Td>
                </tr>
              </Table>
            )}
          </Section>
        )}

        {customerId === "all" && (
          <div className="mt-6 p-4 rounded-[10px] bg-muted/40 border border-border">
            <div className="flex items-center justify-between font-bold text-lg">
              <span>Net (Sales − Expenses)</span>
              <span
                className={`tabular-nums ${totals.net >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatRs(totals.net)}
              </span>
            </div>
          </div>
        )}

        {customerId !== "all" && (
          <div className="mt-6 p-4 rounded-[10px] bg-muted/40 border border-border">
            <div className="flex items-center justify-between font-bold text-lg">
              <span>Outstanding Balance</span>
              <span
                className={`tabular-nums ${totals.pending > 0 ? "text-warning" : "text-success"}`}
              >
                {formatRs(totals.pending)}
              </span>
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          Thank you for your business · Shifaf Aab
        </div>
      </div>

      {/* Monthly and Daily Reports (Visible in UI, Hidden in Print) */}
      <div className="print:hidden mt-8 space-y-6">
        {/* Monthly Reports */}
        <div className="card-surface p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Monthly Reports</h3>
              <p className="text-xs text-muted-foreground">
                Download comprehensive statement logs for past months.
              </p>
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Select Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {availableMonthsQ.isLoading ? (
            <div className="py-10 text-center text-xs text-muted-foreground animate-pulse">
              Loading available months...
            </div>
          ) : activeMonthCards.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground italic">
              No delivery data recorded for {selectedYear}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeMonthCards.map((m) => (
                <button
                  key={m.label}
                  disabled={!!downloadingMonth}
                  onClick={() => handleDownloadMonth(m)}
                  className="p-3 text-left border border-border rounded-xl bg-muted/20 hover:bg-muted transition-colors flex items-center justify-between text-xs font-semibold disabled:opacity-50"
                >
                  <span>{m.label}</span>
                  <Download className="h-4 w-4 text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Daily Reports */}
        <div className="card-surface p-5">
          <h3 className="font-bold text-lg mb-1">Daily Operations</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Generate and download single-day operational reports.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative w-full sm:max-w-[200px]">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="h-11 w-full pl-9 pr-3 rounded-[10px] border border-border bg-card text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              disabled={downloadingDaily}
              onClick={handleDownloadDaily}
              className="h-11 px-6 rounded-[10px] bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />{" "}
              {downloadingDaily ? "Generating..." : "Download Daily PDF"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 14mm; size: A4; }
          body { background: white !important; }
          header, nav, aside, .print\\:hidden { display: none !important; }
          main { padding: 0 !important; }
          #report { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </AdminShell>
  );
}

function Sum({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive";
}) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-[10px] border border-border p-3">
      <p className="text-[11px] uppercase font-semibold text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-bold">{title}</h3>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      {children}
    </div>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className={`text-left p-3 font-semibold ${i === head.length - 1 ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`p-3 ${className}`}>
      {children}
    </td>
  );
}
function Empty() {
  return (
    <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-[10px] text-center">
      No records in this range.
    </div>
  );
}
