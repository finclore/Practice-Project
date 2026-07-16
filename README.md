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
up first, then be promoted to Firm Administrator.

Steps:

1. Open the app and complete sign-up / sign-in with the intended admin email
   through the Supabase Auth flow (or invite a user from the Supabase
   dashboard and have them set a password).
2. While that user is signed in, run the following from the app or from the
   Supabase SQL editor authenticated as that user:

   ```sql
   select public.bootstrap_first_admin('DEMO');
   ```

   The `bootstrap_first_admin` function is `SECURITY DEFINER` but restricted:
   - Requires an authenticated caller (`auth.uid()` must be set).
   - Refuses to run if the target firm already has any active Firm
     Administrator.
   - Creates a `profiles` row (if missing) and a `firm_memberships` row with
     the caller as `FIRM_ADMIN`.

3. Sign out and back in. The user now reaches `/work` with the
   Administration desk visible.

For any additional users, the first Firm Administrator will add them via the
admin UI in a later build slice — this v1 slice intentionally ships without
member-management screens.

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
