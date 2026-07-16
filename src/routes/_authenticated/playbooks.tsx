import { createFileRoute, redirect } from "@tanstack/react-router";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";

export const Route = createFileRoute("/_authenticated/playbooks")({
  head: () => ({ meta: [{ title: "Playbooks · Finclore Practice" }] }),
  component: PlaybooksDesk,
});

function PlaybooksDesk() {
  // Role gate is applied in navigation; a direct URL visit for a non-eligible
  // role still lands here — show the same restrained empty state.
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

// keep redirect import to satisfy linter if future guard is added
void redirect;
