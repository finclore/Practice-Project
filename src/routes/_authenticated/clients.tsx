import { createFileRoute } from "@tanstack/react-router";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients · Finclore Practice" }] }),
  component: ClientsDesk,
});

function ClientsDesk() {
  return (
    <>
      <DeskHeader title="Clients Desk" question="Which client do I need to work with?" />
      <DeskBody>
        <EmptyState
          title="No clients yet"
          description="Client records and engagements will live here. This desk will surface the clients you own and the ones needing attention once client data is added."
        />
      </DeskBody>
    </>
  );
}
