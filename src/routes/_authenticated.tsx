import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Droplet } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    // Role-based route protection
    if (role === "worker" && pathname.startsWith("/admin")) {
      navigate({ to: "/worker/dashboard", replace: true });
    } else if (role === "admin" && pathname.startsWith("/worker")) {
      navigate({ to: "/admin/dashboard", replace: true });
    }
  }, [session, role, loading, pathname, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="h-12 w-12 rounded-2xl bg-primary grid place-items-center animate-pulse">
          <Droplet className="h-6 w-6 text-primary-foreground" fill="currentColor" />
        </div>
      </div>
    );
  }

  // Prevent flash of unauthorized content during redirect
  if (role === "worker" && pathname.startsWith("/admin")) return null;
  if (role === "admin" && pathname.startsWith("/worker")) return null;

  return <Outlet />;
}
