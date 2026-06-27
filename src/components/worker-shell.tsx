import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Truck, Users, Receipt, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/worker/dashboard", label: "Home", icon: Home },
  { to: "/worker/deliveries", label: "Deliveries", icon: Truck },
  { to: "/worker/customers", label: "Customers", icon: Users },
  { to: "/worker/expenses", label: "Expenses", icon: Receipt },
];

export function WorkerShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[390px] min-h-screen pb-24">{children}</div>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card">
        <div className="mx-auto max-w-[390px] grid grid-cols-4">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-1 py-2.5 text-xs"
              >
                <span
                  className={`grid place-items-center h-9 w-14 rounded-full transition-colors ${active ? "bg-accent" : ""}`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </span>
                <span
                  className={`${active ? "text-primary font-semibold" : "text-muted-foreground"}`}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function TopBar({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}
