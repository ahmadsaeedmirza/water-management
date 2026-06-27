import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { WorkerShell, TopBar } from "@/components/worker-shell";
import { formatRs, formatTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/worker/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const { user, name } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [eName, setEName] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); })();

  const expensesQ = useQuery({
    queryKey: ["expenses", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("worker_id", user!.id)
        .gte("created_at", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!eName.trim() || !amt || amt <= 0) throw new Error("Enter a name and amount");
      const { error } = await supabase.from("expenses").insert({
        worker_id: user!.id,
        name: eName.trim(),
        amount: amt,
      });
      if (error) throw error;
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins?.length) {
        await supabase.from("notifications").insert(admins.map((a) => ({
          user_id: a.user_id,
          kind: "expense",
          message: `${name || "Worker"} added expense "${eName.trim()}" · ${formatRs(amt)}`,
        })));
      }
      // self confirmation
      await supabase.from("notifications").insert({
        user_id: user!.id,
        kind: "expense_self",
        message: `Expense added — ${eName.trim()} · ${formatRs(amt)}`,
      });
    },
    onSuccess: () => {
      toast.success("Expense added");
      setEName(""); setAmount(""); setErrors({}); setOpen(false);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add expense"),
  });

  const handleAdd = () => {
    const newErrors: Record<string, string> = {};
    if (!eName.trim()) {
      newErrors.name = "Expense name is required";
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      newErrors.amount = "Please enter a valid amount";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    add.mutate();
  };

  const total = (expensesQ.data ?? []).reduce((s, e: any) => s + Number(e.amount), 0);

  return (
    <WorkerShell>
      <TopBar title="Today's Expenses" subtitle={formatRs(total) + " total"} />
      <div className="px-5 py-5 space-y-3">
        {expensesQ.isLoading ? (
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
        ) : (expensesQ.data ?? []).length === 0 ? (
          <div className="card-surface p-8 text-center">
            <div className="h-14 w-14 mx-auto rounded-full bg-muted grid place-items-center">
              <Receipt className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mt-3 font-semibold">No expenses today</p>
            <p className="text-sm text-muted-foreground mt-1">Tap + to add one.</p>
          </div>
        ) : (
          (expensesQ.data ?? []).map((e: any) => (
            <div key={e.id} className="card-surface p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-destructive/15 grid place-items-center">
                <Receipt className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{e.name}</p>
                <p className="text-xs text-muted-foreground">{formatTime(e.created_at)}</p>
              </div>
              <p className="font-bold text-destructive">{formatRs(e.amount)}</p>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => {
          setErrors({});
          setOpen(true);
        }}
        className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg grid place-items-center hover:bg-primary/90"
        aria-label="Add expense"
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-card rounded-t-[20px] mx-auto max-w-[390px] p-6 pb-8 animate-in slide-in-from-bottom duration-250">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-xl font-bold">Add Expense</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold tracking-wider text-muted-foreground">DATE & TIME</label>
                <input
                  type="text"
                  value={`Today, ${formatTime(new Date())}`}
                  readOnly
                  disabled
                  className="mt-2 h-12 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground cursor-not-allowed outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-wider text-muted-foreground">EXPENSE NAME</label>
                <input
                  value={eName}
                  onChange={(e) => {
                    setEName(e.target.value);
                    setErrors((errs) => ({ ...errs, name: "" }));
                  }}
                  placeholder="e.g. Fuel"
                  className="mt-2 h-12 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
                {errors.name && <p className="text-xs text-destructive mt-1 font-semibold">{errors.name}</p>}
              </div>
              <div>
                <label className="text-xs font-bold tracking-wider text-muted-foreground">AMOUNT (Rs.)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrors((errs) => ({ ...errs, amount: "" }));
                  }}
                  placeholder="0"
                  className="mt-2 h-12 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
                {errors.amount && <p className="text-xs text-destructive mt-1 font-semibold">{errors.amount}</p>}
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={add.isPending}
              className="mt-6 h-12 w-full rounded-[10px] bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 transition-opacity"
            >
              {add.isPending ? "Adding..." : "Add Expense"}
            </button>
          </div>
        </div>
      )}
    </WorkerShell>
  );
}

