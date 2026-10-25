export const ACTIONS = ["can_view", "can_create", "can_edit", "can_delete"] as const;
export type Action = (typeof ACTIONS)[number];
export const ACTION_LABEL: Record<Action, string> = {
  can_view: "View",
  can_create: "Create",
  can_edit: "Edit",
  can_delete: "Delete",
};

export type PermFlags = Record<Action, boolean>;
export const EMPTY: PermFlags = { can_view: false, can_create: false, can_edit: false, can_delete: false };

/**
 * Toggle one action in a matrix cell. Granting create/edit/delete also grants view
 * (you cannot change what you cannot see); removing view removes everything.
 */
export function toggleAction(flags: PermFlags, action: Action): PermFlags {
  const next = { ...flags, [action]: !flags[action] };
  if (action !== "can_view" && next[action]) next.can_view = true;
  if (action === "can_view" && !next.can_view) return { ...EMPTY };
  return next;
}

/** Combine several roles: a user gets an action if any of their roles grants it. */
export function mergePermissions(list: PermFlags[]): PermFlags {
  return list.reduce<PermFlags>(
    (acc, p) => ({
      can_view: acc.can_view || p.can_view,
      can_create: acc.can_create || p.can_create,
      can_edit: acc.can_edit || p.can_edit,
      can_delete: acc.can_delete || p.can_delete,
    }),
    { ...EMPTY },
  );
}
