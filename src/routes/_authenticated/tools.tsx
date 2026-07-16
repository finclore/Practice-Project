import { createFileRoute } from "@tanstack/react-router";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({ meta: [{ title: "Tools · Finclore Practice" }] }),
  component: ToolsDesk,
});

function ToolsDesk() {
  return (
    <>
      <DeskHeader title="Tools Desk" question="Which utility do I need right now?" />
      <DeskBody>
        <EmptyState
          title="No tools available yet"
          description="Firm-wide utilities and one-off calculators will appear here. Tools are added deliberately, one at a time, as real needs arise."
        />
      </DeskBody>
    </>
  );
}
