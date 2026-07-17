import { createFileRoute, Link } from "@tanstack/react-router";
import { DeskBody, DeskHeader } from "@/components/desk";
import { RoleGuard } from "@/components/role-guard";
import { useReadySession } from "@/lib/session-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/administration/")({
  head: () => ({ meta: [{ title: "Administration · Finclore Practice" }] }),
  component: AdministrationRoute,
});

const ALLOWED_ROLES = ["FIRM_ADMIN"] as const;

function AdministrationRoute() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <AdministrationDesk />
    </RoleGuard>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value ?? "—"}</span>
    </div>
  );
}

function AdministrationDesk() {
  const { firm, branding, profile, role } = useReadySession();

  return (
    <>
      <DeskHeader
        title="Administration Desk"
        question="How is the firm configured?"
        actions={
          <Link
            to="/administration/services"
            className="text-sm font-medium text-primary hover:underline"
          >
            Services catalog →
          </Link>
        }
      />

      <DeskBody>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Firm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <Row label="Display name" value={firm.display_name} />
              <Row label="Legal name" value={firm.legal_name} />
              <Row label="Firm code" value={firm.firm_code} />
              <Row label="Status" value={firm.status} />
              <Row label="Country" value={firm.country_code} />
              <Row label="State" value={firm.primary_state_code} />
              <Row label="Timezone" value={firm.timezone} />
              <Row label="Currency" value={firm.default_currency} />
              <Row label="Date format" value={firm.date_format} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <Row label="Brand name" value={branding?.brand_display_name} />
              <Row label="Tagline" value={branding?.tagline} />
              <Row label="Primary color" value={branding?.primary_color_hex} />
              <Row label="Secondary color" value={branding?.secondary_color_hex} />
              <Row label="Font" value={branding?.default_font_family} />
              <Row label="Signatory" value={branding?.default_signatory_name} />
              <Row label="Signatory title" value={branding?.default_signatory_title} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signed-in user</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <Row label="Display name" value={profile.display_name} />
              <Row label="First name" value={profile.first_name} />
              <Row label="Last name" value={profile.last_name} />
              <Row label="Job title" value={profile.job_title} />
              <Row label="Status" value={profile.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <Row label="Role" value={role.name} />
              <Row label="Code" value={role.code} />
              <Row label="Level" value={String(role.role_level)} />
              <Row label="Description" value={role.description} />
            </CardContent>
          </Card>
        </div>
      </DeskBody>
    </>
  );
}
