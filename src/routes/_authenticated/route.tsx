import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SessionProvider, useSessionContext } from "@/lib/session-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  ),
});

function Gate() {
  const s = useSessionContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (s.kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (s.kind === "unauthenticated") {
    // beforeLoad already redirected; safety fallback.
    navigate({ to: "/auth", replace: true });
    return null;
  }

  if (s.kind === "no_membership") {
    return (
      <BlockScreen
        title="Access not configured"
        message="Your account is not yet linked to a firm. Please contact your firm administrator to be added to Finclore Practice."
        onSignOut={signOut}
      />
    );
  }

  if (s.kind === "membership_suspended") {
    return (
      <BlockScreen
        title="Access suspended"
        message="Your membership has been suspended. Please contact your firm administrator to restore access."
        onSignOut={signOut}
      />
    );
  }

  if (s.kind === "firm_suspended") {
    return (
      <BlockScreen
        title="Firm access unavailable"
        message="Your firm is currently unavailable in Finclore Practice. Please contact your firm administrator."
        onSignOut={signOut}
      />
    );
  }

  if (s.kind === "error") {
    return (
      <BlockScreen
        title="Something went wrong"
        message={s.message}
        onSignOut={signOut}
      />
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function BlockScreen({
  title,
  message,
  onSignOut,
}: {
  title: string;
  message: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {message}
        </p>
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
