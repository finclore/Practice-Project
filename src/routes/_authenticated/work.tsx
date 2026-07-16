import { createFileRoute } from "@tanstack/react-router";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({ meta: [{ title: "Work · Finclore Practice" }] }),
  component: WorkDesk,
});

function WorkDesk() {
  return (
    <>
      <DeskHeader title="Work Desk" question="What needs my attention?" />
      <DeskBody>
        <EmptyState
          title="Nothing waiting for you yet"
          description="Assigned work, review decisions, and items waiting on you will appear here as the firm begins routing engagements through Finclore Practice."
        />
      </DeskBody>
    </>
  );
}
