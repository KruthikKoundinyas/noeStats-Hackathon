import ProjectMember from "../models/project-member.js";
import { permissionsFor } from "../config/permissions.js";

export async function getUserProjects(userId) {
  const memberships = await ProjectMember.find({ userId })
    .populate("projectId", "name status")
    .sort({ joinedAt: -1 });

  return memberships
    .filter((membership) => membership.projectId)
    .map((membership) => ({
      projectId: membership.projectId._id,
      name: membership.projectId.name,
      status: membership.projectId.status,
      joinedAt: membership.joinedAt,
      role: {
        name: membership.role,
        permissions: permissionsFor(membership.role),
      },
    }));
}
