import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { formatRs, formatDate, formatTime } from "@/lib/format";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/expenses")({
  component: AdminExpenses,
});

function AdminExpenses() {
  const qc = useQueryClient();
  const [range, setRange] = useState<"today" | "month" | "all">("month");

  const q = useQuery({
    queryKey: ["adm-expenses-list", range],
    queryFn: async () => {
      let qry = supabase.from("expenses").select("*").order("created_at", { ascending: false });
      if (range !== "all") {
        const d = new Date();
        if (range === "today") d.setHours(0, 0, 0, 0);
        else {
          d.setDate(1);
          d.setHours(0, 0, 0, 0);
        }
        qry = qry.gte("created_at", d.toISOString());
      }
      const { data, error } = await qry;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("adm-expenses-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () =>
        qc.invalidateQueries({ queryKey: ["adm-expenses-list"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const list = q.data ?? [];
  const total = useMemo(() => list.reduce((a, e: any) => a + Number(e.amount), 0), [list]);

  return (
    <AdminShell title="Expenses" subtitle="Read-only log of worker expenses">
      <div className="card-surface p-5 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">Total</p>
          <p className="text-2xl font-bold tabular-nums text-destructive">{formatRs(total)}</p>
        </div>
        <div className="inline-flex rounded-[10px] bg-muted p-1">
          {(["today", "month", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 h-9 rounded-[8px] text-xs font-semibold capitalize ${range === r ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
            >
              {r === "today" ? "Today" : r === "month" ? "Month" : "All"}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-accent grid place-items-center">
            <Receipt className="h-7 w-7 text-primary" />
          </div>
          <p className="mt-3 font-bold">No expenses logged</p>
          <p className="text-sm text-muted-foreground">Expenses will appear as workers log them.</p>
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <ul className="divide-y divide-border">
            {list.map((e: any) => (
              <li key={e.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.created_at)} · {formatTime(e.created_at)}
                  </p>
                </div>
                <p className="font-bold tabular-nums text-destructive">{formatRs(e.amount)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminShell>
  );
}
