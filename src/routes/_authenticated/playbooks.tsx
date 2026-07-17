import { createFileRoute } from "@tanstack/react-router";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";
import { RoleGuard } from "@/components/role-guard";

export const Route = createFileRoute("/_authenticated/playbooks")({
  head: () => ({ meta: [{ title: "Playbooks · Finclore Practice" }] }),
  component: PlaybooksRoute,
});

// Firm Administrators, Managers, and Reviewers may reach the Playbooks
// desk in this slice. Reviewer read-only semantics will be enforced at
// content level once real playbooks ship.
const ALLOWED_ROLES = ["FIRM_ADMIN", "MANAGER", "REVIEWER"] as const;

function PlaybooksRoute() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <PlaybooksDesk />
    </RoleGuard>
  );
}

function PlaybooksDesk() {
  return (
    <>
      <DeskHeader title="Playbooks Desk" question="How does the firm do this work?" />
      <DeskBody>
        <EmptyState
          title="No playbooks yet"
          description="Firm-standard procedures and repeatable workflows will be published here. Managers and administrators will define playbooks in an upcoming release."
        />
      </DeskBody>
    </>
  );
}
