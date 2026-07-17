import { createFileRoute, Link } from "@tanstack/react-router";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";
import {
  useClient,
  useEngagementsForClient,
  statusBadgeTone,
} from "@/lib/practice-queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({ meta: [{ title: "Client · Finclore Practice" }] }),
  component: ClientDetail,
});

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value ?? "—"}</span>
    </div>
  );
}

function ClientDetail() {
  const { clientId } = Route.useParams();
  const c = useClient(clientId);
  const e = useEngagementsForClient(clientId);

  if (c.isLoading) {
    return (
      <>
        <DeskHeader title="Client" question="Loading…" />
        <DeskBody>
          <div className="text-sm text-muted-foreground">Loading client…</div>
        </DeskBody>
      </>
    );
  }
  if (c.error) {
    return (
      <>
        <DeskHeader title="Client" question="Couldn't load client" />
        <DeskBody>
          <EmptyState
            title="Error"
            description={(c.error as Error).message}
          />
        </DeskBody>
      </>
    );
  }
  if (!c.data) {
    return (
      <>
        <DeskHeader title="Client" question="Client not found" />
        <DeskBody>
          <EmptyState
            title="Not found"
            description="This client does not exist or is not accessible to your firm."
          />
        </DeskBody>
      </>
    );
  }

  const client = c.data;

  return (
    <>
      <DeskHeader
        title={`Client · ${client.client_code}`}
        question={client.display_name}
        actions={<Badge variant={statusBadgeTone(client.status)}>{client.status}</Badge>}
      />
      <DeskBody>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <Row label="Code" value={client.client_code} />
              <Row label="Display name" value={client.display_name} />
              <Row label="Legal name" value={client.legal_name} />
              <Row label="Status" value={client.status} />
              <Row label="Primary contact" value={client.primary_contact_email} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.notes?.trim() ? client.notes : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Engagements
          </h2>
          {e.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading engagements…</div>
          ) : e.error ? (
            <EmptyState
              title="Couldn't load engagements"
              description={(e.error as Error).message}
            />
          ) : !e.data || e.data.length === 0 ? (
            <EmptyState
              title="No engagements yet"
              description="This client has no engagements. Engagement creation ships in the next sprint."
            />
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Reference</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {e.data.map((eng) => (
                    <TableRow key={eng.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          to="/engagements"
                          className="hover:underline"
                        >
                          {eng.engagement_reference}
                        </Link>
                      </TableCell>
                      <TableCell>{eng.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {eng.service?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeTone(eng.status)}>
                          {eng.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DeskBody>
    </>
  );
}
