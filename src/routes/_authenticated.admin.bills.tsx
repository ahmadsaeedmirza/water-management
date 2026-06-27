import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { formatRs, formatDate, formatTime } from "@/lib/format";
import { Printer, Calendar, FileText, Droplet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/bills")({
  component: AdminBills,
});

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthAgo() { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }

function AdminBills() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(todayStr());
  const [customerId, setCustomerId] = useState<string>("all");

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

  const dataQ = useQuery({
    queryKey: ["bills", from, to, customerId],
    queryFn: async () => {
      let dq = supabase
        .from("deliveries")
        .select("id, bottles_delivered, total_amount, payment_mode, created_at, customer_id, customers(name)")
        .gte("created_at", fromIso).lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (customerId !== "all") dq = dq.eq("customer_id", customerId);
      const [d, p, e] = await Promise.all([
        dq,
        customerId !== "all"
          ? supabase.from("payments").select("amount, payment_mode, created_at").eq("customer_id", customerId).gte("created_at", fromIso).lte("created_at", toIso)
          : supabase.from("payments").select("amount, payment_mode, created_at").gte("created_at", fromIso).lte("created_at", toIso),
        supabase.from("expenses").select("name, amount, created_at").gte("created_at", fromIso).lte("created_at", toIso),
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
    const sales = data.deliveries.reduce((a, d: any) => a + Number(d.total_amount), 0);
    const expenses = data.expenses.reduce((a, e: any) => a + Number(e.amount), 0);
    const payments = data.payments.reduce((a, p: any) => a + Number(p.amount), 0);
    const pending = data.deliveries.filter((d: any) => d.payment_mode === "pending").reduce((a, d: any) => a + Number(d.total_amount), 0);
    return { bottles, sales, expenses, payments, pending, net: sales - expenses };
  }, [data]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const title = customerId === "all" ? "Business Report" : `Statement · ${selectedCustomer?.name ?? ""}`;

  const setPreset = (preset: "today" | "week" | "month") => {
    const t = new Date();
    if (preset === "today") { const s = t.toISOString().slice(0,10); setFrom(s); setTo(s); }
    else if (preset === "week") { const f = new Date(); f.setDate(f.getDate() - 6); setFrom(f.toISOString().slice(0,10)); setTo(t.toISOString().slice(0,10)); }
    else { const f = new Date(); f.setDate(1); setFrom(f.toISOString().slice(0,10)); setTo(t.toISOString().slice(0,10)); }
  };

  return (
    <AdminShell
      title="Bills & Reports"
      subtitle="Generate printable reports and customer statements"
      right={
        <button
          onClick={() => window.print()}
          className="h-10 px-4 rounded-[10px] bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95"
        >
          <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print / Save PDF</span>
        </button>
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
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            {(["today", "week", "month"] as const).map((p) => (
              <button key={p} onClick={() => setPreset(p)} className="h-11 px-3 rounded-[10px] border border-border bg-card text-xs font-semibold capitalize hover:bg-muted">{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Printable Report */}
      <div id="report" className="card-surface p-6 md:p-8 print:shadow-none print:border-0 print:p-0">
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
            <p className="text-xs text-muted-foreground">{formatDate(from)} – {formatDate(to)}</p>
            <p className="text-[11px] text-muted-foreground">Generated {formatDate(new Date())} {formatTime(new Date())}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Sum label="Bottles" value={totals.bottles.toString()} />
          <Sum label="Sales" value={formatRs(totals.sales)} />
          <Sum label="Payments In" value={formatRs(totals.payments)} tone="success" />
          {customerId === "all"
            ? <Sum label="Expenses" value={formatRs(totals.expenses)} tone="destructive" />
            : <Sum label="Pending" value={formatRs(totals.pending)} tone="warning" />}
        </div>

        <Section title={customerId === "all" ? "Deliveries" : "Deliveries to this customer"} count={data.deliveries.length}>
          {data.deliveries.length === 0 ? <Empty /> : (
            <Table head={["Date", "Customer", "Bottles", "Method", "Amount"]}>
              {data.deliveries.map((d: any) => (
                <tr key={d.id} className="border-t border-border">
                  <Td>{formatDate(d.created_at)}</Td>
                  <Td>{d.customers?.name ?? "Walk-in"}</Td>
                  <Td className="tabular-nums">{d.bottles_delivered}</Td>
                  <Td className="capitalize">{d.payment_mode}</Td>
                  <Td className="tabular-nums text-right font-semibold">{formatRs(d.total_amount)}</Td>
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
          {data.payments.length === 0 ? <Empty /> : (
            <Table head={["Date", "Method", "Amount"]}>
              {data.payments.map((p: any, i) => (
                <tr key={i} className="border-t border-border">
                  <Td>{formatDate(p.created_at)}</Td>
                  <Td className="capitalize">{p.payment_mode}</Td>
                  <Td className="tabular-nums text-right font-semibold text-success">{formatRs(p.amount)}</Td>
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
            {data.expenses.length === 0 ? <Empty /> : (
              <Table head={["Date", "Description", "Amount"]}>
                {data.expenses.map((e: any, i) => (
                  <tr key={i} className="border-t border-border">
                    <Td>{formatDate(e.created_at)}</Td>
                    <Td>{e.name}</Td>
                    <Td className="tabular-nums text-right font-semibold text-destructive">{formatRs(e.amount)}</Td>
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
              <span className={`tabular-nums ${totals.net >= 0 ? "text-success" : "text-destructive"}`}>{formatRs(totals.net)}</span>
            </div>
          </div>
        )}

        {customerId !== "all" && (
          <div className="mt-6 p-4 rounded-[10px] bg-muted/40 border border-border">
            <div className="flex items-center justify-between font-bold text-lg">
              <span>Outstanding Balance</span>
              <span className={`tabular-nums ${totals.pending > 0 ? "text-warning" : "text-success"}`}>{formatRs(totals.pending)}</span>
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          Thank you for your business · Shifaf Aab
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

function Sum({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "destructive" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-[10px] border border-border p-3">
      <p className="text-[11px] uppercase font-semibold text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-muted-foreground" /><h3 className="font-bold">{title}</h3><span className="text-xs text-muted-foreground">({count})</span></div>
      {children}
    </div>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>{head.map((h, i) => <th key={i} className={`text-left p-3 font-semibold ${i === head.length - 1 ? "text-right" : ""}`}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, className = "", colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`p-3 ${className}`}>{children}</td>;
}
function Empty() {
  return <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-[10px] text-center">No records in this range.</div>;
}
