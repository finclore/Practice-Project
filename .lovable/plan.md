
# Kernel Foundation — Technical Audit

## Executive Verdict
**Fail** — one Critical (bootstrap privilege escalation) plus several High findings that violate the approved slice's write-restriction and route-authorization requirements. Corrections are small; the schema and RLS shape are otherwise sound.

---

## Findings

### CRITICAL

**C1. `bootstrap_first_admin` allows any authenticated user to claim any unconfigured firm.**
- *Evidence:* `bootstrap_first_admin(_firm_code text)` is `SECURITY DEFINER`, `EXECUTE` is not revoked from `PUBLIC`/`authenticated` (unlike `handle_new_user` in migration 2), and the only guard is "the firm has zero active FIRM_ADMIN memberships". Any signed-up user can call `select public.bootstrap_first_admin('DEMO')` from the app and become admin of DEMO — or of the real live firm if seeded before its admin is provisioned.
- *Impact:* Full cross-tenant privilege escalation on any firm that has not yet had its first admin created. Also enables a race where two concurrent callers both pass the `count = 0` check (no advisory lock, no unique partial index on "one active admin per firm").
- *Correction (smallest):* (a) restrict eligibility to a specific server-side allowlist (either a `bootstrap_token` column on `firms`, or a `SUPABASE_SERVICE_ROLE`-only server function invoked via `createServerFn` using `supabaseAdmin`); (b) `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` and only `GRANT EXECUTE ... TO service_role`; (c) add `SELECT ... FOR UPDATE` on the `firms` row (or a partial unique index `(firm_id) WHERE role_id = FIRM_ADMIN AND status='active'` on `firm_memberships`) to close the race. README then documents "run via SQL editor as service role" or "call the admin server function", not "run as the signed-in app user".

### HIGH

**H1. Profile INSERT/UPDATE grants violate the approved "no client writes on Kernel tables" rule for this slice.**
- *Evidence:* `GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;` plus matching RLS policies. Slice 1 was explicitly "empty foundation, no writes."
- *Impact:* Deviation from approved scope; users can rename themselves before member-management ships. Not exploitable across tenants (RLS scopes to `user_id = auth.uid()`), but off-spec.
- *Correction:* Drop the `INSERT`/`UPDATE` grants and the two write policies on `profiles`. Profile row creation continues to happen through the `handle_new_user` `SECURITY DEFINER` trigger, which bypasses grants.

**H2. Route authorization is cosmetic only — direct URL access is not enforced.**
- *Evidence:* `AppShell` filters the nav via `hasRole`, but every `/_authenticated/*` route is component-only. A Staff user typing `/administration` reaches the route; `administration.tsx` renders a "Restricted" empty state (soft gate), but `/playbooks` has no role check at all — it renders the same content to every role. There is no `beforeLoad` role gate, and Reviewer's "read-only Playbooks" is not distinguished from Manager's.
- *Impact:* Client-side-only authorization; contradicts the audit's explicit "direct URL access, not navigation visibility" requirement. Low blast radius today because Desks are empty, but the pattern will carry into slices that render sensitive content.
- *Correction:* Add a shared `requireRole(codes)` helper that gates in `beforeLoad` (reading session via a router context/loader) or a pathless `_authenticated/_admin` / `_authenticated/_playbooks` layout with a role check; render an "Access denied" component on mismatch. Encode Reviewer's read-only distinction as a capability flag rather than a separate policy for this slice.

**H3. `firm_branding` "one active per firm" not enforced correctly.**
- *Evidence:* The partial unique index exists (`WHERE status = 'active'`), which is correct. However, `SessionProvider.loadFirmContext` calls `.maybeSingle()` on `firm_branding WHERE status='active'` — if the invariant is ever violated (e.g. via service_role) the query errors and the whole session flips to `error`. Minor.
- *Correction:* Change to `.limit(1).maybeSingle()` on an ordered query, or accept the current shape and note the invariant.

**H4. Query errors in `loadFirmContext` are silently swallowed and misclassified.**
- *Evidence:* `loadFirmContext` destructures `data` only, ignoring `error`, from all three parallel queries. If `firms` returns an error (network, RLS regression), `q2.data.firm` is falsy and the gate reports `firm_suspended`. Similarly `loadContext` ignores the profile query's `error`.
- *Impact:* Real failures are shown to the user as "Firm access unavailable", which is misleading and slows debugging.
- *Correction:* Surface errors from each sub-query and throw so the outer `useQuery` sets `error`; the gate already handles `kind: "error"`.

### MEDIUM

**M1. `user_active_role_id()` tie-break is not fully deterministic.**
- *Evidence:* Orders by `is_primary_firm DESC, created_at ASC`. Two memberships created in the same millisecond, or two rows both flagged `is_primary_firm=true` (nothing prevents it — no partial unique index on `(user_id) WHERE is_primary_firm`), can flap.
- *Correction:* Add `, id ASC` as a final tiebreak; add a partial unique index `ON firm_memberships(user_id) WHERE is_primary_firm AND status='active'` in a later slice when multi-firm is introduced.

**M2. Access-date window (`access_start_date`/`access_end_date`) is stored but not enforced.**
- *Evidence:* `user_has_active_firm` and `user_active_role_id` check `status='active'` only. A membership with `access_end_date < today` still grants access.
- *Correction:* Add `AND (fm.access_end_date IS NULL OR fm.access_end_date >= current_date) AND fm.access_start_date <= current_date` to both helpers, and mirror the check in `loadContext` when picking the membership.

**M3. `/reset-password` behaviour for an already-signed-in user is unsafe.**
- *Evidence:* Route sets `ready=true` on any existing session (`getSession().then(... setReady(true))`), not only `PASSWORD_RECOVERY`. An ordinary signed-in user who opens `/reset-password` can silently change their password without proving current password — indistinguishable from a recovery flow.
- *Impact:* Session-hijack amplifier: any XSS or brief unlocked-laptop window becomes password takeover.
- *Correction:* Gate `ready` strictly on the `PASSWORD_RECOVERY` event fired during this page load; if `getSession()` returns a session but no recovery event has fired, show "Open the reset link from your email" and redirect signed-in users to `/work`.

**M4. `/reset-password` `redirectTo` is not registered.**
- *Evidence:* `resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })`. Works locally; in Supabase Auth settings the URL must be added to Redirect URLs. Not a code defect, but README omits it.
- *Correction:* README addition.

**M5. `handle_new_user` writes `display_name` from `email` local-part with no sanitization.**
- *Evidence:* `split_part(NEW.email, '@', 1)` — profile row can carry `+tag`, dots, apostrophes. Cosmetic in v1.
- *Correction:* Note only; revisit in profile-management slice.

**M6. `roles` RLS returns only the caller's *active* role.**
- *Evidence:* Policy `id = user_active_role_id()`. Correct for the current UI, but any future need to render "assign role" dropdowns will require a broader policy. Not a defect today.
- *Correction:* None now; noted for later.

### LOW

**L1.** README says "run … from the Supabase SQL editor authenticated as that user". Supabase's SQL editor executes as `postgres`/service role, not the signed-in app user — `auth.uid()` is NULL there, so the current `bootstrap_first_admin` guard `IF auth.uid() IS NULL THEN RAISE` will reject that path. Instructions are not executable as written. Fix alongside C1.

**L2.** `src/routes/index.tsx` uses `useEffect` + `navigate` for the auth split; a `beforeLoad` redirect is cheaper and avoids the "Loading…" flash. Minor UX.

**L3.** `SessionProvider` `useQuery` `staleTime: 60_000` means a role/branding change made by admin tooling is invisible for up to a minute. Acceptable for v1; consider `router.invalidate()` on relevant admin actions later.

**L4.** No index on `firm_memberships(user_id)` — the FK to `auth.users` typically gets one via the unique `(firm_id, user_id)` index (leftmost is `firm_id`, so lookups by `user_id` do a scan). Add `CREATE INDEX ON firm_memberships(user_id)`.

**L5.** `firms.status` seed value is `active` for DEMO; helpers already accept `('active','setup')`. Fine, but Constitution suggests new firms begin at `setup`.

**L6.** Generated `types.ts` is in git and will regenerate on every migration — confirm workflow does not fight edits.

### Not Verified / Assumptions
- No signed-in user was available; RLS checks are read-through of policies, not live probes.
- No `bun run typecheck`/`build` was executed (audit is read-only).
- I did not verify Supabase Auth "Redirect URLs" list; that is dashboard config outside the repo.
- I assumed the "one live firm + DEMO" seeding intent — no production firm row exists yet in the migration.

---

## Correction Sequence (small sprints, one objective each)

**Sprint A — Lock down bootstrap (fixes C1, L1).**
- Objective: Make first-admin bootstrap non-exploitable and executable.
- Approach: `REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin(text) FROM PUBLIC, anon, authenticated;` keep only `service_role`. Add either (i) a `bootstrap_token` column on `firms` consumed and nulled inside the function, or (ii) a TanStack `createServerFn` calling it via `supabaseAdmin` and gated by a one-shot env token. Add row lock. Rewrite README bootstrap steps.
- Acceptance: signed-in call from browser to the RPC returns permission denied; running via SQL editor with a valid firm succeeds exactly once; second concurrent call fails deterministically.

**Sprint B — Remove Kernel client writes (fixes H1).**
- Objective: Enforce "no client writes on Kernel tables" for this slice.
- Approach: drop `INSERT`/`UPDATE` grants and matching policies on `profiles`; keep the auth trigger.
- Acceptance: from the browser client, `supabase.from('profiles').update(...)` returns permission denied; sign-up still auto-creates the profile row.

**Sprint C — Real route authorization (fixes H2).**
- Objective: Enforce role gates by URL, not by nav filtering.
- Approach: introduce `beforeLoad` role check on `/_authenticated/administration` and `/_authenticated/playbooks` using session context resolved through router context; unauthorized users get a shared "Access denied" component.
- Acceptance: Staff/Viewer/Client Services directly navigating to `/administration` or `/playbooks` see "Access denied", not the desk content; Firm Admin and Manager pass as approved.

**Sprint D — Error surfacing in session context (fixes H4, H3).**
- Objective: Distinguish real errors from "firm suspended".
- Approach: propagate `error` from all sub-queries in `loadContext` / `loadFirmContext`; branding query becomes `order().limit(1).maybeSingle()`.
- Acceptance: forcing a query error yields the `error` block, not `firm_suspended`; multiple active brandings (simulated) do not crash the session.

**Sprint E — Access-date and determinism (fixes M1, M2).**
- Objective: Correct membership eligibility rules.
- Approach: extend `user_has_active_firm` and `user_active_role_id` with the date-window predicates and `id ASC` tiebreak; mirror in JS picker.
- Acceptance: a membership past its `access_end_date` is treated as no-membership; two active memberships resolve deterministically.

**Sprint F — Password reset hardening (fixes M3, M4).**
- Objective: Prevent silent password change from an ordinary session.
- Approach: require observed `PASSWORD_RECOVERY` event before enabling the form; otherwise redirect signed-in users away and prompt others to reopen the email link. Document required Supabase Redirect URL entry.
- Acceptance: opening `/reset-password` while signed in without a recovery token does not show the form; the recovery link continues to work end-to-end.

**Sprint G — Cleanups (L2, L4).**
- Objective: Small quality wins.
- Approach: convert `/` route to a `beforeLoad` redirect; add `firm_memberships(user_id)` index.
- Acceptance: no "Loading…" flash on `/`; query plan uses the new index.

Stop after Sprint A–F for a "Pass" verdict; Sprint G is optional polish.
