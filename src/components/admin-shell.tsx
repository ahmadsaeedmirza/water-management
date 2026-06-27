import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, PackageOpen, Users, Receipt, Bell, FileText, LogOut, Droplet, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const nav: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/lots", label: "Lots & Deliveries", icon: PackageOpen },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/expenses", label: "Expenses", icon: Receipt },
  { to: "/admin/bills", label: "Bills & Reports", icon: FileText },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
];

const mobileNav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/bills", label: "Bills", icon: Receipt },
  { to: "/admin/bills?tab=reports", label: "Reports", icon: FileText },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
];

export function AdminShell({ children, title, subtitle, right }: { children: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { name, signOut, user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      if (!cancelled) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("admin-notifs-shell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  const Sidebar = (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-5 py-5 border-b border-border flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary grid place-items-center">
          <Droplet className="h-5 w-5 text-primary-foreground" fill="currentColor" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-foreground">Shifaf Aab</p>
          <p className="text-xs text-muted-foreground">Admin Console</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((n) => {
          const active = pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 px-3 h-11 rounded-[10px] text-sm font-semibold transition-colors ${active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.5 : 2} />
              <span className="flex-1">{n.label}</span>
              {n.to === "/admin/notifications" && unread > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold tabular-nums">{unread}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="px-3 py-2 mb-2 text-xs">
          <p className="font-semibold text-foreground truncate">{name || "Admin"}</p>
          <p className="text-muted-foreground">Administrator</p>
        </div>
        <button
          onClick={signOut}
          className="w-full h-10 rounded-[10px] border border-border bg-card text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-muted"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row pb-16 md:pb-0">
      <div className="hidden md:flex sticky top-0 h-screen">{Sidebar}</div>
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 md:px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
              </div>
            </div>
            {right}
          </div>
        </header>
        <div className="px-4 md:px-8 py-6 pb-20 md:pb-6">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card">
        <div className="grid grid-cols-5">
          {mobileNav.map((t) => {
            const isReports = t.label === "Reports";
            const isBills = t.label === "Bills";
            const active = isReports
              ? pathname.startsWith("/admin/bills") && window.location.search.includes("tab=reports")
              : isBills
                ? pathname.startsWith("/admin/bills") && !window.location.search.includes("tab=reports")
                : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.label}
                to={t.to}
                className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium"
              >
                <span className={`grid place-items-center h-8 w-12 rounded-full transition-colors ${active ? "bg-accent" : ""}`}>
                  <span className="relative">
                    <Icon className={`h-4.5 w-4.5 ${active ? "text-primary" : "text-muted-foreground"}`} strokeWidth={active ? 2.5 : 2} />
                    {t.label === "Notifications" && unread > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">{unread}</span>
                    )}
                  </span>
                </span>
                <span className={`${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

