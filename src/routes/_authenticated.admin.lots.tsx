import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { formatRs, formatDate, formatTime } from "@/lib/format";
import { PackageOpen, ChevronDown, CircleDot, CheckCircle2, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/lots")({
  component: AdminLots,
});

function AdminLots() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const lotsQ = useQuery({
    queryKey: ["adm-lots", date],
    queryFn: async () => {
      const start = new Date(date + "T00:00:00").toISOString();
      const end = new Date(date + "T23:59:59").toISOString();
      const { data, error } = await supabase
        .from("lots")
        .select(
          "*, deliveries(id, bottles_delivered, total_amount, payment_mode, created_at, customer_type, customers(name))",
        )
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("adm-lots")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, () =>
        qc.invalidateQueries({ queryKey: ["adm-lots"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () =>
        qc.invalidateQueries({ queryKey: ["adm-lots"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <AdminShell title="Lots" subtitle="History of bottle lots loaded by workers">
      <div className="card-surface p-4 mb-4 flex items-center gap-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase shrink-0">
          Filter Date:
        </span>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 pl-9 pr-3 rounded-[10px] border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {lotsQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (lotsQ.data ?? []).length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-3">
          {(lotsQ.data ?? []).map((lot: any) => {
            const sold = (lot.deliveries ?? []).reduce(
              (a: number, d: any) => a + d.bottles_delivered,
              0,
            );
            const revenue = (lot.deliveries ?? []).reduce(
              (a: number, d: any) => a + Number(d.total_amount),
              0,
            );
            const open = openId === lot.id;
            const active = lot.status === "active";
            return (
              <div key={lot.id} className="card-surface overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : lot.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/50 text-left"
                >
                  <div
                    className={`h-11 w-11 rounded-[10px] grid place-items-center ${active ? "bg-accent text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {active ? (
                      <CircleDot className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">Lot · {lot.total_bottles} bottles</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(lot.created_at)} · {formatTime(lot.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">
                      {sold}/{lot.total_bottles}
                    </p>
                    <p className="text-xs text-success font-semibold tabular-nums">
                      {formatRs(revenue)}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <div className="border-t border-border bg-muted/30">
                    {(lot.deliveries ?? []).length === 0 ? (
                      <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                        No deliveries logged for this lot.
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {lot.deliveries.map((d: any) => (
                          <li
                            key={d.id}
                            className="px-5 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {d.customers?.name ?? "Walk-in"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {d.bottles_delivered} bottle(s) · {formatTime(d.created_at)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold tabular-nums">
                                {formatRs(d.total_amount)}
                              </p>
                              <p
                                className={`text-[11px] font-semibold uppercase ${d.payment_mode === "pending" ? "text-warning" : "text-success"}`}
                              >
                                {d.payment_mode}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

function Empty() {
  return (
    <div className="card-surface p-10 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl bg-accent grid place-items-center">
        <PackageOpen className="h-7 w-7 text-primary" />
      </div>
      <h3 className="mt-3 font-bold">No lots found</h3>
      <p className="text-sm text-muted-foreground mt-1">No lots were loaded on this date.</p>
    </div>
  );
}
