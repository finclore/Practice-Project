import type { ReactNode } from "react";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";
import { hasRole, useReadySession, type RoleCode } from "@/lib/session-context";

/**
 * Route-level authorization boundary.
 *
 * Wraps a Desk's contents. If the caller's active role is not in `allow`,
 * the wrapped content is NOT rendered at all — a shared Access Denied
 * page is rendered instead. This is the single source of truth for
 * per-Desk authorization; do not also guard within the desk body.
 *
 * The check runs before any protected content mounts, so a user typing
 * a URL directly cannot reach desk content by bypassing the nav filter.
 */
export function RoleGuard({
  allow,
  children,
}: {
  allow: RoleCode[];
  children: ReactNode;
}) {
  const { role } = useReadySession();
  if (!hasRole(role, allow)) return <AccessDenied />;
  return <>{children}</>;
}

export function AccessDenied() {
  return (
    <>
      <DeskHeader title="Access denied" question="You don't have access to this area" />
      <DeskBody>
        <EmptyState
          title="Restricted"
          description="This area is not available for your role. If you believe you should have access, contact your Firm Administrator."
        />
      </DeskBody>
    </>
  );
}
