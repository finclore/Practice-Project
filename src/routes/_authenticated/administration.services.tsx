import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeskBody, DeskHeader, EmptyState } from "@/components/desk";
import { RoleGuard } from "@/components/role-guard";
import { useReadySession } from "@/lib/session-context";
import { useServices, statusBadgeTone } from "@/lib/practice-queries";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/administration/services")({
  head: () => ({ meta: [{ title: "Services · Administration · Finclore Practice" }] }),
  component: ServicesRoute,
});

function ServicesRoute() {
  return (
    <RoleGuard allow={["FIRM_ADMIN"]}>
      <ServicesCatalog />
    </RoleGuard>
  );
}

function ServicesCatalog() {
  const { firm } = useReadySession();
  const qc = useQueryClient();
  const q = useServices(firm.id);

  async function archive(id: string) {
    const { error } = await supabase.rpc("archive_service", { _service_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Service archived");
    qc.invalidateQueries({ queryKey: ["services", firm.id] });
  }

  return (
    <>
      <DeskHeader
        title="Administration · Services"
        question="Which services does the firm offer?"
        actions={
          <div className="flex items-center gap-3">
            <Link
              to="/administration"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Administration
            </Link>
            <NewServiceButton firmId={firm.id} />
          </div>
        }
      />
      <DeskBody>
        {q.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading services…</div>
        ) : q.error ? (
          <EmptyState
            title="Couldn't load services"
            description={(q.error as Error).message}
          />
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState
            title="No services defined"
            description="Add the services this firm offers to clients."
          />
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[110px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.service_code}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeTone(s.status)}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {s.status === "active" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archive(s.id)}
                        >
                          Archive
                        </Button>
                      ) : null}
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

function NewServiceButton({ firmId }: { firmId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function submit() {
    setSaving(true);
    const { error } = await supabase.rpc("create_service", {
      _firm_id: firmId,
      _service_code: code,
      _name: name,
      _description: description || undefined,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Service created");
    setOpen(false);
    setCode("");
    setName("");
    setDescription("");
    qc.invalidateQueries({ queryKey: ["services", firmId] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New service</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New service</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="s-code">Service code</Label>
            <Input
              id="s-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="TAX-1120"
            />
          </div>
          <div>
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="s-desc">Description</Label>
            <Textarea
              id="s-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !code.trim() || !name.trim()}>
            {saving ? "Saving…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
