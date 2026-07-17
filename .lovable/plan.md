
# Milestone 2 · Slice 1 — Engagements Foundation

## 1. Scope

**In scope (v1 slice):**
- Minimal `clients` reference table (firm-scoped) — smallest set of fields required to attach an engagement.
- Minimal `services` catalog table (firm-scoped) — the firm-configurable list of service types that engagements reference.
- `engagements` table — the commercial/service agreement between the firm and one client for one service.
- RLS on all three tables using the existing Kernel helper `user_has_active_firm()`; role-differentiated write gates via a security-definer helper `has_firm_role(codes text[])`.
- Lifecycle status model with SECURITY DEFINER RPCs for controlled transitions (`activate`, `close`, `archive`) — no direct client-side `UPDATE` of `status`.
- Engagement Reference Number (ERN) uniqueness within a firm.
- Clients Desk becomes functional (list, minimal create); Engagements sub-surface lives under the Clients Desk answering **"What services have we agreed to provide this client?"** on the client detail page — plus a firm-wide Engagements list view.
- Read/list/detail/create/close/archive flows.
- Access-denied, empty, loading, and error states across every new surface.
- Seed strategy delivered through migrations (schema + optional demo rows in DEMO firm only, behind a firm-code guard so a real firm cannot receive fixture data).

**Explicit exclusions** (deferred, marked as future integration points in schema comments only):
- Engagement **Periods** — a stub FK column will NOT be added yet; periods will introduce their own table in the next slice.
- Tasks, waiting events, deliverables, checklists, playbook execution, staffing assignments.
- Billing, pricing, fee schedules, invoices, retainers.
- Document generation (engagement letter), e-sign, PDF export.
- Client portal, notifications, email, timeline/audit trail UI.
- Full client CRM (contacts, addresses, tax IDs, industry classifications, entity relationships) — only the smallest fields to identify a client.
- Full service catalog (durations, defaults, playbook bindings, jurisdictions) — only the smallest fields to identify a service.
- Bulk operations, imports, exports.
- Reporting, dashboards, metrics.
- Multi-service engagements (v1 = one service per engagement; extensible via a future `engagement_services` join).
- Reassignment/transfer between firms (out of model by Golden Rule 1).
- Client-portal visibility flags on engagements.

## 2. Database objects

### 2.1 `public.clients` — minimal reference layer

Columns:
- `id uuid PK default gen_random_uuid()`
- `firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE RESTRICT`
- `client_code text NOT NULL` — firm-generated short code (e.g. `ACME-001`); unique per firm.
- `display_name text NOT NULL` — day-to-day label.
- `legal_name text NOT NULL` — legal entity name.
- `client_type text NOT NULL CHECK (client_type IN ('individual','entity'))`
- `status text NOT NULL DEFAULT 'active' CHECK (status IN ('prospect','active','inactive','archived'))`
- `primary_contact_email text` (nullable, no verification in v1)
- `country_code text NOT NULL DEFAULT 'US'`
- `notes text`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `created_by uuid REFERENCES auth.users(id)` — set by RPC; not user-editable
- `updated_by uuid REFERENCES auth.users(id)`

Constraints/indexes:
- `UNIQUE (firm_id, client_code)`
- `INDEX (firm_id, status)` for the Clients Desk list
- `INDEX (firm_id, lower(display_name))` for name search (v2 use)

Trigger: `trg_clients_updated_at` using existing `public.set_updated_at()`.

### 2.2 `public.services` — minimal firm-configurable catalog

Columns:
- `id uuid PK`
- `firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE RESTRICT`
- `service_code text NOT NULL` — e.g. `TAX-1040`, `MBK-STD`; unique per firm.
- `name text NOT NULL`
- `description text`
- `category text NOT NULL CHECK (category IN ('tax','accounting','advisory','other'))`
- `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived'))`
- Audit fields as above.

Constraints/indexes:
- `UNIQUE (firm_id, service_code)`
- `INDEX (firm_id, status)`

### 2.3 `public.engagements` — commercial agreement

Columns:
- `id uuid PK`
- `firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE RESTRICT`
- `client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT`
- `service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT`
- `engagement_ref text NOT NULL` — firm-scoped stable reference (e.g. `ENG-2026-0001`).
- `title text NOT NULL` — human-readable summary.
- `description text`
- `status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','on_hold','completed','archived'))`
- `agreement_date date` — the date the commercial agreement is made (required to leave `draft`).
- `service_start_date date` — the date service delivery begins.
- `service_end_date date` — nullable; enforced `>= service_start_date` when both present.
- `owner_user_id uuid REFERENCES auth.users(id)` — engagement owner (Manager or Firm Admin).
- `close_reason text` — required when status transitions to `completed` or `archived`.
- Audit fields.

Constraints/indexes:
- `UNIQUE (firm_id, engagement_ref)`
- Cross-firm integrity check: a validation trigger asserts `client.firm_id = engagement.firm_id` and `service.firm_id = engagement.firm_id` on INSERT/UPDATE. Prevents an authenticated user from sneaking a cross-firm client/service via a crafted `INSERT` even if RLS lets them see both (they won't, but defense in depth).
- Date sanity trigger (see §8).
- `INDEX (firm_id, status)`
- `INDEX (firm_id, client_id)`
- `INDEX (firm_id, owner_user_id)`

Reserved (documented in a schema comment, **not** created yet):
```sql
-- Future: engagement_periods(engagement_id) will attach the execution instances.
-- Do not add a period_id column here; period-vs-engagement separation is intentional.
```

### 2.4 Status model — the only allowed transitions

```
                +-------+ activate  +--------+ close   +-----------+
     create --> | draft | --------> | active | ------> | completed |
                +-------+           +--------+ pause   +-----------+
                    |                 ^   |   <------
                    |                 |   v put_on_hold  archive (from any non-active)
                    |                 |   +---------+       |
                    |                 +---| on_hold |       v
                    |                     +---------+  +----------+
                    +-------------- archive --------->| archived |
                                                       +----------+
```

Allowed transitions (enforced by RPC, not just CHECK):
- `draft → active` (RPC `activate_engagement`) — requires `agreement_date`, `service_start_date`, and `owner_user_id` all set.
- `active → on_hold` (RPC `hold_engagement`)
- `on_hold → active` (RPC `resume_engagement`)
- `active | on_hold → completed` (RPC `complete_engagement`, requires `close_reason`)
- `draft | on_hold | completed → archived` (RPC `archive_engagement`, requires `close_reason`)
- No hard deletes; `archived` is the terminal soft-delete state.

## 3. Minimal Clients & Services reference layer — required, yes

Rationale: an Engagement cannot exist without a Client and a Service (Golden Rule 2 — one business question requires "what service, for which client"). We ship the **smallest** viable versions above. Fuller Clients and Services modules land as their own slices later. Fields explicitly deferred are listed in §1 exclusions.

## 4. Tenant isolation & RLS

All three tables:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- `GRANT SELECT ON ... TO authenticated`
- `GRANT ALL ON ... TO service_role`
- **No** direct `INSERT/UPDATE/DELETE` grants to `authenticated`. All writes flow through `SECURITY DEFINER` RPCs (see §5). This mirrors Sprint B's write-lockdown discipline and is the safest posture for the first Practice Engine slice.

SELECT policy on each table:
```sql
CREATE POLICY "read firm-scoped rows" ON public.<table>
  FOR SELECT TO authenticated
  USING (public.user_has_active_firm(firm_id));
```

Role-differentiated **read** filtering: v1 does not filter reads by role (all firm members can read all clients/services/engagements of their firm). Row-level visibility filters (e.g. Staff sees only engagements they own) is a future enhancement flagged as a Product Owner Decision (§11).

New helper (added in this slice, following the pattern of `user_has_active_firm`):

```sql
CREATE OR REPLACE FUNCTION public.has_firm_role(_codes text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_memberships fm
    JOIN public.roles r ON r.id = fm.role_id
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND r.code = ANY(_codes)
  )
$$;
REVOKE ALL ON FUNCTION public.has_firm_role(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_firm_role(text[]) TO authenticated;
```

## 5. Controlled write model (per role)

All writes are `SECURITY DEFINER` RPCs. Each RPC:
1. Requires `auth.uid()`.
2. Calls `user_has_active_firm(target_firm_id)` to reject cross-firm attempts.
3. Calls `has_firm_role(<allowed codes>)` to gate by role.
4. Stamps `created_by` / `updated_by`.
5. Validates business rules (dates, references, transitions) atomically.

Permission matrix:

| Action | RPC | FIRM_ADMIN | MANAGER | REVIEWER | STAFF | CLIENT_SERVICES | VIEWER |
|---|---|---|---|---|---|---|---|
| Create client | `create_client` | ✓ | ✓ | — | — | ✓ | — |
| Update client (non-status) | `update_client` | ✓ | ✓ | — | — | ✓ | — |
| Archive client | `archive_client` | ✓ | ✓ | — | — | — | — |
| Create service | `create_service` | ✓ | — | — | — | — | — |
| Update service | `update_service` | ✓ | — | — | — | — | — |
| Archive service | `archive_service` | ✓ | — | — | — | — | — |
| Create engagement (draft) | `create_engagement` | ✓ | ✓ | — | — | — | — |
| Update engagement metadata | `update_engagement` | ✓ | ✓ | — | — | — | — |
| Activate engagement | `activate_engagement` | ✓ | ✓ | — | — | — | — |
| Hold / Resume | `hold_engagement` / `resume_engagement` | ✓ | ✓ | — | — | — | — |
| Complete | `complete_engagement` | ✓ | ✓ | — | — | — | — |
| Archive | `archive_engagement` | ✓ | ✓ | — | — | — | — |
| Read all above | (RLS SELECT) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Rationale for RPCs over direct RLS writes: status transitions must be atomic and rule-checked; two engagements racing to `active` need a serialization point; ownership stamping (`updated_by`) is easier to enforce in a definer function than via triggers alone; and RPCs give one clean audit surface later.

## 6. Audit fields & lifecycle

- Every write RPC sets `created_by` on INSERT and `updated_by` on UPDATE from `auth.uid()`.
- `updated_at` maintained by trigger.
- No hard deletes anywhere — `archived` is terminal soft-delete. `ON DELETE RESTRICT` on FK references keeps referential integrity.
- A dedicated `engagement_events` audit log is **out of scope** for this slice but flagged as a near-term follow-up (see §11).

## 7. UI & routes

Route tree additions (all under `_authenticated/`):
- `clients.tsx` (existing) → becomes the **Clients Desk** list view.
- `clients.$clientId.tsx` → client detail with "Engagements" section.
- `clients.new.tsx` → create client form.
- `engagements.tsx` → firm-wide Engagements list (filter by status, owner, client).
- `engagements.$engagementId.tsx` → engagement detail with status transition actions.
- `engagements.new.tsx` → create engagement wizard (client picker → service picker → dates/owner → title).
- `administration.services.tsx` → services catalog (under Administration desk, FIRM_ADMIN only).
- `administration.services.new.tsx` → create service.

Desk pattern reuse:
- Every list view uses `DeskHeader` + `DeskBody`; empty state uses existing `EmptyState`.
- `RoleGuard` wraps every route with a non-VIEWER write concern.
- Detail pages have three explicit states — loading (skeleton), error (via route `errorComponent`), not-found (via `notFoundComponent`).
- Access-denied uses the existing shared component from Sprint C.

Nav update:
- Add "Engagements" between Clients and Playbooks in `AppShell` NAV. Visible to all authenticated roles.

## 8. Validation rules

Enforced in RPCs (with matching `CHECK` where feasible):
- **Engagement reference uniqueness**: `UNIQUE(firm_id, engagement_ref)`; RPC generates default as `ENG-<YYYY>-<seq>` if caller omits.
- **Client code uniqueness**: `UNIQUE(firm_id, client_code)`.
- **Service code uniqueness**: `UNIQUE(firm_id, service_code)`.
- **Cross-firm FK**: trigger asserts `client.firm_id = engagement.firm_id` and `service.firm_id = engagement.firm_id` on every INSERT/UPDATE (rather than a CHECK, because CHECK cannot reference other tables).
- **Dates**: `service_end_date IS NULL OR service_end_date >= service_start_date`; `agreement_date <= service_start_date` when both set. Use a validation trigger, not a CHECK, so future business exceptions (e.g. retroactive engagements) can be encoded there.
- **Status transitions**: only via the specific RPC; a defensive trigger rejects any direct `UPDATE ... SET status = ...` that isn't done via the definer function (checked by asserting `current_setting('finclore.transition_ok', true) = 'yes'` set inside each RPC).
- **Referenced client/service must be non-archived** on engagement create/activate. Archiving a client or service refuses if any non-archived engagement references it (checked in the archive RPCs).
- **Owner must be an active member of the same firm** at create/activate time.

## 9. Seed / test data strategy

- Migration seeds the schema only.
- A separate, **DEMO-firm-guarded** migration inserts a small fixture: two clients, three services, three engagements in mixed statuses. Guard: `WHERE firm_code = 'DEMO'` — no fixture ever lands in a real firm even if the migration runs there.
- No fixtures written from the browser. No page-load seeding. No public seed server function.
- E2E test users continue to be minted only via the Sprint A `bootstrap_first_admin` service-role path; other test-firm memberships are added in a future admin UI slice.

## 10. Migration order, files, tests, rollback

### Migration order (one SQL migration per numbered step, applied in order)
1. `has_firm_role` helper.
2. `clients` table, trigger, RLS SELECT policy, grants.
3. `services` table, trigger, RLS SELECT policy, grants.
4. `engagements` table, triggers (updated_at, cross-firm FK, date sanity, transition-gate), RLS SELECT policy, grants.
5. Client write RPCs (`create_client`, `update_client`, `archive_client`).
6. Service write RPCs.
7. Engagement write + transition RPCs.
8. Optional demo-fixture insert migration guarded on `firm_code='DEMO'`.

Each RPC migration includes its own `REVOKE ... FROM PUBLIC, anon` and `GRANT EXECUTE ... TO authenticated` and asserts firm/role/transition rules internally.

### Source-file changes (planned; not implemented in this plan step)
- `src/integrations/supabase/types.ts` — regenerated after migrations.
- `src/lib/practice/engagements.ts` — Supabase read hooks + RPC callers (typed).
- `src/lib/practice/clients.ts`, `src/lib/practice/services.ts` — same.
- `src/routes/_authenticated/clients.tsx` — replaces current empty desk with list view.
- `src/routes/_authenticated/clients.$clientId.tsx` — new.
- `src/routes/_authenticated/clients.new.tsx` — new.
- `src/routes/_authenticated/engagements.tsx` — new.
- `src/routes/_authenticated/engagements.$engagementId.tsx` — new.
- `src/routes/_authenticated/engagements.new.tsx` — new.
- `src/routes/_authenticated/administration.services.tsx` — new.
- `src/routes/_authenticated/administration.services.new.tsx` — new.
- `src/components/app-shell.tsx` — add Engagements nav entry.
- `src/components/practice/*` — small shared form/status-badge components.

### Test / acceptance matrix
| Case | Expectation |
|---|---|
| Manager creates engagement in own firm | Succeeds; row visible to all firm roles |
| Manager creates engagement pointing at another firm's client | Rejected by cross-firm FK trigger |
| Staff attempts `create_engagement` RPC | Rejected by `has_firm_role` guard |
| Direct `UPDATE engagements SET status='active'` via PostgREST | Fails (no UPDATE grant to authenticated) |
| Activate from `draft` without `agreement_date` | RPC raises validation error |
| Complete without `close_reason` | RPC raises validation error |
| Archive engagement, then attempt to activate | RPC refuses (terminal state) |
| Archive service still referenced by active engagement | RPC refuses |
| VIEWER opens `/engagements` | Sees list; write buttons absent (RoleGuard/UX) |
| VIEWER hits `/engagements/new` directly | Access-denied desk |
| Two Managers race to activate same engagement | Serialized by row lock in RPC; second call sees "already active" |
| Firm A user queries client from Firm B by id | RLS returns 0 rows |
| Deleting a firm cascades — engagements still exist? | RESTRICT prevents delete; matches Golden Rule 1 |

### Rollback
Each migration is reversible via a paired `DROP` migration (dropped in reverse order). Because no destructive data changes occur (only new tables and functions), a rollback is a `DROP TABLE` / `DROP FUNCTION` sequence and does not risk existing Kernel data. Demo-fixture migration is trivially reversible with a `DELETE ... WHERE firm_code='DEMO'` guarded reversal.

## 11. Decisions requiring product-owner approval

1. **Row-level read filtering by role.** v1 treats all firm members as full readers of all clients/services/engagements. Future: should Staff see only engagements they own? Should Client Services be limited to a subset? Deferred by default; needs sign-off.
2. **Multi-service engagements.** v1 = one service per engagement. Confirm this is acceptable before enabling; if multi-service is required day-one, an `engagement_services` join table changes the schema.
3. **Engagement reference format & generation.** Proposed `ENG-<YYYY>-<seq>` per firm; alternative is firm-configurable prefix + counter. Confirm.
4. **Owner semantics.** Owner = Manager or Firm Admin. Should Reviewer be an eligible owner in v1? Proposed: no.
5. **`draft` visibility.** Should drafts be visible to VIEWER / STAFF, or only to authors and Managers? Proposed: visible to all firm members (simpler, no cross-role hiding); alternative narrows draft visibility.
6. **Client status "prospect" vs "active" gating.** Should a `prospect` client be eligible for a non-draft engagement? Proposed: no — activation requires `client.status = 'active'`.
7. **Audit log**. Ship the `engagement_events` audit trail table in this slice, or defer to slice 2 alongside Periods? Proposed: defer.
8. **Services live under Administration, not their own top-level Desk.** Confirm.

## 12. Recommended build sprint

Given the breadth, a single sprint for **all** of the above is too large. Recommended split into two implementation sprints under Milestone 2 · Slice 1, each independently reviewable:

### Sprint E1 — Reference layer + read-only Engagements
- Migrations 1–4 (helper, clients, services, engagements) plus SELECT policies and grants.
- Client + service **create/update/archive** RPCs (safe to ship — no engagement lifecycle yet).
- Read-only surfaces: Clients Desk list, Client detail, Services catalog under Administration, Engagements list (empty until seed / until Sprint E2 creates any).
- Demo-firm fixture migration.
- **Complexity**: Medium. **Est. credits**: ~40–60% of a typical DB-plus-UI slice — mostly schema and list UI, no wizard.

### Sprint E2 — Engagement writes & lifecycle
- Engagement create wizard, detail page with transition actions.
- All engagement RPCs (`create/update/activate/hold/resume/complete/archive`).
- Direct-UPDATE lockdown trigger.
- Full test matrix (§10) executed.
- **Complexity**: Medium-High (state machine + validation + wizard UX). **Est. credits**: ~60–80% of a typical slice.

If the product owner prefers a single sprint, name it **Sprint E** and expect roughly 1.4–1.8× the size of Sprint C+D combined. The two-sprint split is strongly recommended for reviewability and to keep Sprint E1's schema stable before wiring the state machine.

### Recommendation
Approve **Sprint E1** first, defer Sprint E2 until E1 is merged and the "what services have we agreed to provide this client?" question is visibly answered on-screen with real firm data. This keeps each sprint aligned to one business question and one reviewable slice, per the Constitution.
