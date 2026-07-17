# Finclore Practice

Practice operations platform for accounting firms.

## Local development

1. Install dependencies: `bun install`
2. Run the dev server: `bun run dev`
3. Ensure the Supabase project is connected. Env vars are populated automatically in Lovable:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Bootstrap the first Firm Administrator

The kernel migration seeds one dummy firm (`firm_code = 'DEMO'`) and the six
fixed roles. No auth users are seeded — a real Supabase Auth user must sign
up first, then be promoted to Firm Administrator by a trusted operator.

`public.bootstrap_first_admin(firm_code, user_email)` is `SECURITY DEFINER`
and callable **only by the `service_role`**. It cannot be invoked from the
browser, from a signed-in session, or from an unauthenticated client — the
`EXECUTE` privilege is revoked from `PUBLIC`, `anon`, and `authenticated`.
Internally it:

- Locks the target firm row (`SELECT ... FOR UPDATE`) so concurrent calls
  serialize and only one can succeed.
- Refuses to run if the firm already has any active Firm Administrator.
- Requires both a firm code and the target user's email — no implicit
  "whoever is calling" semantics.
- Ensures a `profiles` row exists for the target user, then inserts an
  active `FIRM_ADMIN` membership.

### Steps

1. The intended administrator signs up (or is invited) through the normal
   Supabase Auth flow so an `auth.users` row exists for their email.
2. A trusted operator with access to the Supabase project runs the
   bootstrap from the **Supabase SQL editor** — that editor executes as
   `postgres`, which is permitted to call service-role-only functions:

   ```sql
   select public.bootstrap_first_admin('DEMO', 'admin@example.com');
   ```

   The function returns the new membership id on success and raises a
   descriptive error on failure (unknown firm, unknown user, or an
   administrator already exists).
3. The administrator signs in to the app and lands on `/work` with the
   Administration desk visible.

Do **not** expose this function through a public server function or
`createServerFn` without additional authorization; use it only from the
Supabase SQL editor or from an operator-only maintenance path that already
holds the `SUPABASE_SERVICE_ROLE_KEY`.

For any additional users, the first Firm Administrator will add them via
the admin UI in a later build slice — this v1 slice intentionally ships
without member-management screens.

## Roles

Fixed six-role catalog:

| Code             | Name                | Level |
| ---------------- | ------------------- | ----- |
| FIRM_ADMIN       | Firm Administrator  | 10    |
| MANAGER          | Manager             | 20    |
| REVIEWER         | Reviewer            | 30    |
| STAFF            | Staff               | 40    |
| CLIENT_SERVICES  | Client Services     | 50    |
| VIEWER           | Viewer              | 60    |

## Security

- Row-level security is enabled on every kernel table.
- Users can only read their own profile and their own memberships.
- Users can only read firms and branding for firms where they hold an active
  membership.
- The active role is exposed via a security-definer helper.
- No client-side inserts / updates / deletes are permitted on kernel tables
  in this slice.
