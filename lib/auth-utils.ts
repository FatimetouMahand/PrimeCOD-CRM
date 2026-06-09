/**
 * Permission utility — même logique que l'ancienne app.
 * ADMIN = super-utilisateur (passe toujours).
 * SUPERVISOR = droits de lecture par défaut sur commandes, produits, statuts.
 * AGENT / AGENT_TEST = droits explicites uniquement.
 */

export type Permissions = {
  canViewOrders: boolean;
  canEditOrders: boolean;
  canViewUsers: boolean;
  canEditUsers: boolean;
  canViewProducts: boolean;
  canEditProducts: boolean;
  canViewStatuses: boolean;
  canEditStatuses: boolean;
  canViewReporting: boolean;
  canViewDashboard: boolean;
};

/**
 * Vérifie si un utilisateur a une permission spécifique.
 * ADMIN bypasse tout et retourne toujours true.
 */
export function hasPermission(
  role: string | undefined,
  permissions: Partial<Permissions> | undefined,
  required: keyof Permissions
): boolean {
  if (!role) return false;

  // ADMIN = super-utilisateur
  if (role === "ADMIN") return true;

  // SUPERVISOR a des droits de lecture par défaut
  if (role === "SUPERVISOR") {
    if (required === "canViewOrders")   return true;
    if (required === "canViewProducts") return true;
    if (required === "canViewStatuses") return true;
    if (required === "canViewReporting") return true;
    if (required === "canViewDashboard") return true;
  }

  if (!permissions) return false;
  return permissions[required] === true;
}

/**
 * Vérifie si un utilisateur peut accéder à une route.
 */
export function canAccessRoute(
  role: string | undefined,
  permissions: Partial<Permissions> | undefined,
  pathname: string
): boolean {
  if (!role) return false;

  if (pathname === "/dashboard")
    return hasPermission(role, permissions, "canViewDashboard");

  if (pathname.startsWith("/employees"))
    return role === "ADMIN" && hasPermission(role, permissions, "canViewUsers");

  if (pathname.startsWith("/orders"))
    return hasPermission(role, permissions, "canViewOrders");

  if (pathname.startsWith("/products"))
    return (role === "ADMIN" || role === "SUPERVISOR") && hasPermission(role, permissions, "canViewProducts");

  if (pathname.startsWith("/statuses"))
    return role === "ADMIN" && hasPermission(role, permissions, "canViewStatuses");

  if (pathname.startsWith("/settings"))
    return role === "ADMIN";

  return true;
}
