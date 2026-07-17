import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";
import { useReadySession, hasRole } from "@/lib/session-context";
import { useClients, statusBadgeTone } from "@/lib/practice-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients · Finclore Practice" }] }),
  component: ClientsDesk,
});

function ClientsDesk() {
  const { firm, role } = useReadySession();
  const canManage = hasRole(role, ["FIRM_ADMIN", "MANAGER"]);
  const q = useClients(firm.id);

  return (
    <>
      <DeskHeader
        title="Clients Desk"
        question="Which client do I need to work with?"
        actions={canManage ? <NewClientButton firmId={firm.id} /> : undefined}
      />
      <DeskBody>
        {q.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading clients…</div>
        ) : q.error ? (
          <EmptyState
            title="Couldn't load clients"
            description={(q.error as Error).message}
          />
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState
            title="No clients yet"
            description={
              canManage
                ? "Add your first client to begin tracking engagements."
                : "No clients have been added to this firm yet."
            }
          />
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Legal name</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">
                      {c.client_code}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/clients/$clientId"
                        params={{ clientId: c.id }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {c.display_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.legal_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeTone(c.status)}>
                        {c.status}
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

function NewClientButton({ firmId }: { firmId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [legal, setLegal] = useState("");
  const [status, setStatus] = useState("prospect");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function submit() {
    setSaving(true);
    const { error } = await supabase.rpc("create_client", {
      _firm_id: firmId,
      _client_code: code,
      _display_name: name,
      _legal_name: legal || undefined,
      _status: status,
      _primary_contact_email: email || undefined,
      _notes: notes || undefined,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client created");
    setOpen(false);
    setCode("");
    setName("");
    setLegal("");
    setStatus("prospect");
    setEmail("");
    setNotes("");
    qc.invalidateQueries({ queryKey: ["clients", firmId] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New client</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-code">Client code</Label>
              <Input
                id="c-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ACME"
              />
            </div>
            <div>
              <Label htmlFor="c-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="c-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="c-name">Display name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="c-legal">Legal name</Label>
            <Input
              id="c-legal"
              value={legal}
              onChange={(e) => setLegal(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="c-email">Primary contact email</Label>
            <Input
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !code.trim() || !name.trim()}
          >
            {saving ? "Saving…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
