// Shared role-to-route mapping. Keeping this in one place prevents the
// customer/provider/admin portals from redirecting to each other's dashboards.

export function dashboardForRole(role) {
  if (role === "ADMIN") return "/admin";
  if (role === "PROVIDER") return "/provider";
  return "/customer";
}

export function loginForRole(role) {
  if (role === "ADMIN") return "/admin/login";
  if (role === "PROVIDER") return "/provider/login";
  return "/login";
}

export function roleMatchesPortal(portal, role) {
  if (portal === "admin") return role === "ADMIN";
  if (portal === "provider") return role === "PROVIDER";
  if (portal === "customer") return role === "CUSTOMER";
  return true;
}
