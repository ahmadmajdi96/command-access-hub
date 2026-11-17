<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- This app is ManuQube AMS: permissions are rows in role_action_grants (role × resource × action from the actions catalog); legacy role_permissions/user_system_roles are kept and synced into the new tables by triggers until the UI is moved. Why: dynamic actions without breaking working screens.
- Permission key format is `<system.code>.<resource.key>.<action.key>`; effective access is computed only in SQL `ams_effective_core` (roles ∪ group roles ∪ composites ∪ user allows − user denies; deny wins; non-view implies view; features need their parent page; account active and system access enabled required). Why: one implementation for UI, APIs and tests.
- AMS admin rights are `ams.*` permissions checked with `ams_has`; `super_admin` in user_roles is only a break-glass flag. Why: brief section 5.
- Connected systems authenticate with hashed `system_credentials` verified by `ams_verify_credential` (scopes, expiry, 7-day rotation overlap, per-minute rate limit, api_request_log); v1 `/api/public/v1/access` keeps its response shape, exact email match only. Why: legacy callers keep working without plaintext keys.
- Account creation, disabling, password resets and admin grants go through server functions in `src/lib/admin.functions.ts` that check `ams_has` and `ams_can_manage_user` (no self actions; admin targets need ams.platform.manage_admins; last super admin guarded by SQL triggers). Why: they need privileged auth APIs; public sign-up is disabled.
- First-time initialization is the sole public account-creation exception: a service-role-only durable claim and finalization RPC verify trusted account metadata after auth creation, atomically grant super-admin, and permanently seal setup. Why: auth INSERT triggers may run before app_metadata is saved; finalization prevents false success and concurrent initial admins.
- Visual design mirrors MES Command Center (dark graphite/cyan tokens in styles.css, glass-panel, shared classes in `src/components/kit.tsx`). Why: the user asked for the exact look of those systems.
- Default role profiles use explicit system-specific allowlists; non-administrators never receive delete permissions, and batch actions affect only currently filtered resource IDs. Why: keeps operational access least-privileged and avoids accidental changes to hidden resources.
- Schema changes use Drizzle custom SQL migrations in `drizzle/migrations` (no supabase/migrations folder). Why: the project's existing migration system.
- Audit is written only by DB triggers (`ams_audit_row`), append-only and SHA-256 hash-chained; browser `logAudit` is a no-op. Why: tamper evidence.
- Access changes bump `permission_versions` and queue `outbound_events` via triggers (only for systems with a webhook_url). Why: systems cache by perm_ver.
- DB rule tests live in SQL `ams_selftest()` (fixtures created and rolled back) and run from `src/test/ams-rules.test.ts`. Why: tests the real rules without leaving data behind.
- Safer defaults chosen: profile emails/status are not user-editable; admin-created passwords set must_change_password; setup requires AMS_BOOTSTRAP_TOKEN (missing secret = setup closed); deleting a system with assigned roles is blocked.
- Differences found vs brief §2: `default-role-profile.ts` is still used by the roles screen (kept until the new roles UI replaces it); the four existing systems now have 250 legacy resources plus the Appendix A pages side by side.
