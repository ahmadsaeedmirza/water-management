import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Droplet } from "lucide-react";

export const Route = createFileRoute("/")({
  component: RootRedirect,
});

function RootRedirect() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
    } else {
      navigate({ to: role === "admin" ? "/admin/dashboard" : "/worker/dashboard", replace: true });
    }
  }, [session, role, loading, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="h-12 w-12 rounded-2xl bg-primary grid place-items-center animate-pulse">
        <Droplet className="h-6 w-6 text-primary-foreground" fill="currentColor" />
      </div>
    </div>
  );
}
