import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Droplet, Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign In · Shifaf Aab" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && role) {
      navigate({ to: role === "admin" ? "/admin/dashboard" : "/worker/dashboard", replace: true });
    }
  }, [session, role, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, role: "worker" },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md card-surface p-8">
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-primary grid place-items-center shadow-sm">
            <Droplet className="h-8 w-8 text-primary-foreground" fill="currentColor" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-primary">Shifaf Aab</h2>
        </div>

        <div className="mt-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "signin" ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your deliveries efficiently</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Email Address</label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                placeholder="admin@shifafaab.com"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between">
              <label className="text-sm font-medium">Password</label>
              {mode === "signin" && (
                <button type="button" className="text-sm font-medium text-primary">
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                required
                minLength={6}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-[10px] bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {mode === "signin" ? "Sign In" : "Create Account"}
            <LogIn className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              Need access?{" "}
              <button onClick={() => setMode("signup")} className="font-semibold text-primary">
                Create Account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => setMode("signin")} className="font-semibold text-primary">
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
