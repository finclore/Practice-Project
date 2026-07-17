import { createFileRoute, Link } from "@tanstack/react-router";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";
import { useReadySession } from "@/lib/session-context";
import { useEngagements, statusBadgeTone } from "@/lib/practice-queries";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/engagements")({
  head: () => ({ meta: [{ title: "Engagements · Finclore Practice" }] }),
  component: EngagementsDesk,
});

function EngagementsDesk() {
  const { firm } = useReadySession();
  const q = useEngagements(firm.id);

  return (
    <>
      <DeskHeader
        title="Engagements Desk"
        question="What services have we agreed to provide?"
      />
      <DeskBody>
        {q.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading engagements…</div>
        ) : q.error ? (
          <EmptyState
            title="Couldn't load engagements"
            description={(q.error as Error).message}
          />
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState
            title="No engagements yet"
            description="Engagements will appear here once created. Engagement creation ships in the next sprint."
          />
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Reference</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((e) => (
                  <TableRow key={e.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">
                      {e.engagement_reference}
                    </TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>
                      {e.client ? (
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: e.client.id }}
                          className="hover:underline"
                        >
                          {e.client.display_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.service?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeTone(e.status)}>
                        {e.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DeskBody>
    </>
  );
}
