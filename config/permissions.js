export const PROJECT_ROLES = ["PROJECT_MANAGER", "TEAM_MEMBER", "VIEWER"];

export const PROJECT_PERMISSIONS = {
  PROJECT_MANAGER: [
    "project:read",
    "project:update",
    "member:manage",
    "task:read",
    "task:create",
    "task:update",
    "task:delete",
    "comment:create",
    "comment:delete",
    "activity:read",
  ],
  TEAM_MEMBER: [
    "project:read",
    "project:notes:update",
    "task:read",
    "task:update:assigned",
    "comment:create",
    "activity:read",
  ],
  VIEWER: ["project:read", "task:read", "activity:read"],
};

export function permissionsFor(role) {
  return PROJECT_PERMISSIONS[role] || [];
}
