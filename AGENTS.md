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
- This app is the central access hub for the Cortanex systems: roles are per system, permissions are rows in role_permissions (view/create/edit/delete per resource). Why: lets admins build roles dynamically without code changes.
- Connected systems read access only through `/api/public/v1/access` with their per-system API key. Why: each system has its own login backend, so the hub cannot trust their user tokens.
- Account creation, disabling, password resets and admin grants go through server functions in `src/lib/admin.functions.ts` that verify `is_hub_admin` first. Why: they need privileged auth APIs; public sign-up is disabled.
- Visual design mirrors MES Command Center (dark graphite/cyan tokens in styles.css, glass-panel, shared classes in `src/components/kit.tsx`). Why: the user asked for the exact look of those systems.
