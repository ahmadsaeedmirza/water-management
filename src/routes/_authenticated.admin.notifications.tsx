import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { relativeTime, formatDate, formatTime } from "@/lib/format";
import { Bell, Check, Truck, Receipt, Wallet, PackageOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotifications,
});

const ICONS: Record<string, any> = {
  delivery: Truck,
  expense: Receipt,
  payment: Wallet,
  lot: PackageOpen,
};
const TINTS: Record<string, string> = {
  delivery: "bg-accent text-primary",
  expense: "bg-destructive/10 text-destructive",
  payment: "bg-success/10 text-success",
  lot: "bg-secondary/20 text-secondary-foreground",
};

function AdminNotifications() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["adm-notifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("adm-notifs-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () =>
        qc.invalidateQueries({ queryKey: ["adm-notifs"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adm-notifs"] }),
  });
  const markOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adm-notifs"] }),
  });

  const list = q.data ?? [];
  const unread = list.filter((n: any) => !n.is_read).length;

  return (
    <AdminShell
      title="Notifications"
      subtitle={`${unread} unread of ${list.length}`}
      right={
        unread > 0 ? (
          <button
            onClick={() => markAll.mutate()}
            className="h-10 px-4 rounded-[10px] border border-border bg-card text-sm font-semibold hover:bg-muted inline-flex items-center gap-2"
          >
            <Check className="h-4 w-4" /> Mark all read
          </button>
        ) : null
      }
    >
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-card rounded-xl border border-border space-y-3">
          <Bell className="h-12 w-12 text-[#90E0EF]" />
          <p className="text-[#64748B] text-sm font-medium">No notifications yet</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((n: any) => {
            const Icon = ICONS[n.kind] ?? Bell;
            const tint = TINTS[n.kind] ?? "bg-muted text-muted-foreground";
            return (
              <li
                key={n.id}
                className={`card-surface px-4 py-3 flex items-start gap-3 ${!n.is_read ? "border-primary/30" : ""}`}
              >
                <div
                  className={`h-10 w-10 rounded-[10px] grid place-items-center shrink-0 ${tint}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${!n.is_read ? "font-bold" : "font-medium text-muted-foreground"}`}
                  >
                    {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {relativeTime(n.created_at)} · {formatDate(n.created_at)}{" "}
                    {formatTime(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markOne.mutate(n.id)}
                    className="text-xs font-semibold text-primary hover:underline shrink-0"
                  >
                    Mark read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
