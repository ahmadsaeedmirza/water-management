import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PackageOpen,
  Users,
  Receipt,
  Bell,
  FileText,
  LogOut,
  Droplet,
  UserCircle,
  KeyRound,
  X,
  Clipboard,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/format";
import { toast } from "sonner";

const nav: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/lots", label: "Lots & Deliveries", icon: PackageOpen },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/records", label: "Add Record", icon: Clipboard },
  { to: "/admin/expenses", label: "Expenses", icon: Receipt },
  { to: "/admin/bills", label: "Bills & Reports", icon: FileText },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
];

const mobileNav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/records", label: "Add Record", icon: Clipboard },
  { to: "/admin/bills", label: "Reports", icon: FileText },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "#profile", label: "Profile", icon: UserCircle },
];

export function AdminShell({
  children,
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { name, signOut, user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

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
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        load,
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const Sidebar = (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col h-full">
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
                <span className="ml-auto inline-flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold tabular-nums">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-accent grid place-items-center text-primary font-bold text-sm shrink-0">
            {initials(name || "Admin")}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{name || "Admin"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || "admin@shifafaab.com"}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mt-1">
          <button
            onClick={() => setPasswordOpen(true)}
            className="w-full h-9 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted flex items-center justify-center gap-1.5"
          >
            <KeyRound className="h-3.5 w-3.5" /> Change Password
          </button>
          <button
            onClick={signOut}
            className="w-full h-9 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/15 flex items-center justify-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row pb-24 md:pb-0">
      <div className="hidden md:flex sticky top-0 h-screen">{Sidebar}</div>
      <main className="flex-1 min-w-0 flex flex-col justify-between min-h-screen">
        <div className="flex-1">
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
        </div>

        <footer className="w-full h-9 bg-[#0F172A] flex items-center justify-center text-xs text-[#64748B] text-center shrink-0 md:relative fixed bottom-0 left-0 right-0 z-50">
          <span>
            © Shifaf Aab · Powered by{" "}
            <a
              href="https://www.devitytechnologies.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00B4D8] hover:underline"
            >
              Devity Technologies
            </a>
          </span>
        </footer>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-9 inset-x-0 z-40 border-t border-border bg-card">
        <div className="grid grid-cols-6">
          {mobileNav.map((t) => {
            const active = t.to === "#profile" ? profileOpen : pathname.startsWith(t.to);
            const Icon = t.icon;

            const content = (
              <>
                <span
                  className={`grid place-items-center h-8 w-12 rounded-full transition-colors ${active ? "bg-accent" : ""}`}
                >
                  <span className="relative">
                    <Icon
                      className={`h-4.5 w-4.5 ${active ? "text-primary" : "text-muted-foreground"}`}
                      strokeWidth={active ? 2.5 : 2}
                    />
                    {t.label === "Notifications" && unread > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                        {unread}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={`${active ? "text-primary font-semibold" : "text-muted-foreground"}`}
                >
                  {t.label}
                </span>
              </>
            );

            if (t.to === "#profile") {
              return (
                <button
                  key={t.label}
                  onClick={() => setProfileOpen(true)}
                  className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium focus:outline-none"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      {profileOpen && (
        <ProfileDrawer
          onClose={() => setProfileOpen(false)}
          onChangePassword={() => setPasswordOpen(true)}
        />
      )}

      {passwordOpen && (
        <ChangePasswordModal onClose={() => setPasswordOpen(false)} />
      )}
    </div>
  );
}

function ProfileDrawer({
  onClose,
  onChangePassword,
}: {
  onClose: () => void;
  onChangePassword: () => void;
}) {
  const { name, user, signOut } = useAuth();
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 bg-card rounded-t-[20px] p-6 animate-in slide-in-from-bottom duration-200 space-y-5">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border" />
        <h2 className="text-xl font-bold text-center">My Profile</h2>

        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
          <div className="h-12 w-12 rounded-full bg-accent grid place-items-center text-primary font-bold text-lg shrink-0">
            {initials(name || "Admin")}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{name || "Admin"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || "admin@shifafaab.com"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => {
              onClose();
              onChangePassword();
            }}
            className="w-full h-12 rounded-[10px] border border-border bg-card text-sm font-semibold flex items-center justify-center gap-2 hover:bg-muted"
          >
            <KeyRound className="h-4 w-4" /> Change Password
          </button>
          <button
            onClick={signOut}
            className="w-full h-12 rounded-[10px] bg-destructive/10 text-destructive text-sm font-semibold flex items-center justify-center gap-2 hover:bg-destructive/15"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full text-center text-xs font-semibold text-muted-foreground py-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setError("");
    setSuccess("");
    
    if (!currentPassword) {
      setError("Current password is required");
      return;
    }
    if (!newPassword) {
      setError("New password is required");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Confirm password does not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccess("Password updated successfully");
      toast.success("Password updated successfully");
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/40">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl p-6 space-y-4 relative z-10 animate-in slide-in-from-bottom duration-200">
        <h3 className="font-bold text-lg">Change Password</h3>
        <p className="text-xs text-muted-foreground">Update your account security password.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-11 px-3 mt-1 rounded-[10px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Your current password"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-3 mt-1 rounded-[10px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-3 mt-1 rounded-[10px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Confirm new password"
            />
            {error && <p className="text-xs text-destructive mt-1.5 font-semibold">{error}</p>}
            {success && <p className="text-xs text-success mt-1.5 font-semibold">{success}</p>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] border border-border bg-card text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="flex-1 h-11 rounded-[10px] bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
