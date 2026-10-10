import ProjectMember from "../models/project-member.js";
import { permissionsFor } from "../config/permissions.js";
import { fail, validId } from "../utils/http.js";

export function findMembership(projectId, userId) {
  return ProjectMember.findOne({ projectId, userId });
}

export async function hasPermission(user, projectId, permission) {
  if (user.platformRole === "ADMIN") return true;
  const member = await findMembership(projectId, user._id);
  return permissionsFor(member?.role).includes(permission);
}

export async function requirePermission(user, projectId, permission) {
  validId(projectId, "project id");
  if (!(await hasPermission(user, projectId, permission))) {
    fail(403, `Missing permission: ${permission}`);
  }
}
