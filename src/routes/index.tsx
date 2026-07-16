import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/work", replace: true });
      else navigate({ to: "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
