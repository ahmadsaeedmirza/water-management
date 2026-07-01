import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { relativeTime, formatDate, formatTime } from "@/lib/format";
import { Bell, Check, Truck, Receipt, Wallet, PackageOpen, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notification deleted");
      qc.invalidateQueries({ queryKey: ["adm-notifs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notifications cleared");
      qc.invalidateQueries({ queryKey: ["adm-notifs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

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
    const channel = supabase
      .channel("notifications-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          // add new notification to state
          qc.setQueryData(["adm-notifs"], (old: any) => {
            if (!old) return [payload.new];
            if (old.some((n: any) => n.id === payload.new.id)) return old;
            return [payload.new, ...old];
          });
          qc.invalidateQueries({ queryKey: ["adm-notifs"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        <div className="flex gap-2">
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="h-10 px-4 rounded-[10px] border border-border bg-card text-xs sm:text-sm font-semibold hover:bg-muted inline-flex items-center gap-2 shrink-0"
            >
              <Check className="h-4 w-4" /> Mark all read
            </button>
          )}
          {list.length > 0 && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="h-10 px-4 rounded-[10px] border border-border bg-card text-xs sm:text-sm font-semibold hover:bg-muted text-destructive inline-flex items-center gap-2 shrink-0"
            >
              <Trash2 className="h-4 w-4 text-destructive" /> Clear All
            </button>
          )}
        </div>
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
                <div className="flex items-center gap-2 shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={() => markOne.mutate(n.id)}
                      className="text-xs font-semibold text-primary hover:underline shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDeleteId(n.id)}
                    className="h-8 w-8 rounded-lg grid place-items-center text-[#64748B] hover:bg-muted hover:text-destructive transition-colors shrink-0"
                    title="Delete Notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card w-full max-w-sm rounded-xl p-5 border border-border space-y-4 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base">Delete Notification</h3>
            <p className="text-sm text-muted-foreground">Delete this notification?</p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="h-9 px-4 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteOne.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card w-full max-w-sm rounded-xl p-5 border border-border space-y-4 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-destructive">Clear All Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Delete all notifications? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmClearAll(false)}
                className="h-9 px-4 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearAll.mutate();
                  setConfirmClearAll(false);
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
