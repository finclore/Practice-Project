import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Role = Database["public"]["Tables"]["roles"]["Row"];
export type Firm = Database["public"]["Tables"]["firms"]["Row"];
export type FirmMembership = Database["public"]["Tables"]["firm_memberships"]["Row"];
export type FirmBranding = Database["public"]["Tables"]["firm_branding"]["Row"];

export type RoleCode =
  | "FIRM_ADMIN"
  | "MANAGER"
  | "REVIEWER"
  | "STAFF"
  | "CLIENT_SERVICES"
  | "VIEWER";

export type SessionStateKind =
  | "loading"
  | "unauthenticated"
  | "no_membership"
  | "membership_suspended"
  | "firm_suspended"
  | "ready"
  | "error";

export type SessionContextValue =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string }
  | { kind: "no_membership"; user: User; profile: Profile | null }
  | { kind: "membership_suspended"; user: User; profile: Profile | null }
  | { kind: "firm_suspended"; user: User; profile: Profile | null }
  | {
      kind: "ready";
      user: User;
      profile: Profile;
      membership: FirmMembership;
      firm: Firm;
      role: Role;
      branding: FirmBranding | null;
    };

const Ctx = createContext<SessionContextValue | null>(null);

export function useSessionContext(): SessionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSessionContext used outside <SessionProvider>");
  return v;
}

/** Convenience: only valid when kind === 'ready' */
export function useReadySession() {
  const v = useSessionContext();
  if (v.kind !== "ready") throw new Error("Session not ready");
  return v;
}

async function loadContext(userId: string) {
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr) throw pErr;

  const { data: memberships, error: mErr } = await supabase
    .from("firm_memberships")
    .select("*")
    .eq("user_id", userId)
    .order("is_primary_firm", { ascending: false })
    .order("created_at", { ascending: true });

  if (mErr) throw mErr;

  if (!memberships || memberships.length === 0) {
    return { profile, memberships: [] as FirmMembership[], picked: null };
  }

  // Prefer active primary → active any → first
  const picked =
    memberships.find((m) => m.status === "active" && m.is_primary_firm) ??
    memberships.find((m) => m.status === "active") ??
    memberships[0];

  return { profile, memberships, picked };
}

async function loadFirmContext(firmId: string, roleId: string) {
  const [firmRes, roleRes, brandingRes] = await Promise.all([
    supabase.from("firms").select("*").eq("id", firmId).maybeSingle(),
    supabase.from("roles").select("*").eq("id", roleId).maybeSingle(),
    // Defensive .limit(1) + ordering guards against a hypothetical violation
    // of the "one active branding per firm" partial-unique-index invariant
    // (e.g. via service_role). The invariant itself is unchanged.
    supabase
      .from("firm_branding")
      .select("*")
      .eq("firm_id", firmId)
      .eq("status", "active")
      .order("version_number", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (firmRes.error) throw firmRes.error;
  if (roleRes.error) throw roleRes.error;
  if (brandingRes.error) throw brandingRes.error;

  return { firm: firmRes.data, role: roleRes.data, branding: brandingRes.data };
}


export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  const q = useQuery({
    queryKey: ["session-context", userId],
    enabled: !!userId,
    queryFn: () => loadContext(userId!),
    staleTime: 60_000,
  });

  const picked = q.data?.picked;
  const q2 = useQuery({
    queryKey: ["firm-context", picked?.firm_id, picked?.role_id],
    enabled: !!picked && picked.status !== "pending" && picked.status !== "ended",
    queryFn: () => loadFirmContext(picked!.firm_id, picked!.role_id),
    staleTime: 60_000,
  });

  let value: SessionContextValue;

  if (session === undefined) {
    value = { kind: "loading" };
  } else if (session === null) {
    value = { kind: "unauthenticated" };
  } else if (q.isLoading || (picked && q2.isLoading)) {
    value = { kind: "loading" };
  } else if (q.error || q2.error) {
    const err = (q.error ?? q2.error) as Error;
    value = { kind: "error", message: err.message };

  } else if (!q.data?.picked) {
    value = {
      kind: "no_membership",
      user: session.user,
      profile: q.data?.profile ?? null,
    };
  } else {
    const m = q.data.picked;
    if (m.status === "suspended") {
      value = { kind: "membership_suspended", user: session.user, profile: q.data.profile };
    } else if (m.status !== "active") {
      value = { kind: "no_membership", user: session.user, profile: q.data.profile };
    } else if (!q2.data?.firm) {
      // Firm invisible under RLS → suspended/archived
      value = { kind: "firm_suspended", user: session.user, profile: q.data.profile };
    } else if (!q.data.profile || !q2.data.role) {
      value = { kind: "error", message: "Session context incomplete." };
    } else {
      value = {
        kind: "ready",
        user: session.user,
        profile: q.data.profile,
        membership: m,
        firm: q2.data.firm,
        role: q2.data.role,
        branding: q2.data.branding ?? null,
      };
    }
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function hasRole(role: Role | undefined | null, codes: RoleCode[]): boolean {
  if (!role) return false;
  return codes.includes(role.code as RoleCode);
}
