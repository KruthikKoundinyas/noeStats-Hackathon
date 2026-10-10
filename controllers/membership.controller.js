import ProjectMember from "../models/project-member.js";
import Project from "../models/project.js";
import User from "../models/user.js";
import { PROJECT_ROLES } from "../config/permissions.js";
import { recordActivity } from "../services/activity.service.js";
import { createNotification } from "../services/notification.service.js";
import { withMutationLock } from "../services/mutation-lock.service.js";
import { requirePermission } from "../services/permission.service.js";
import { emitToProject } from "../services/realtime.service.js";
import { fail, requireFields, validId } from "../utils/http.js";

export async function listMembers(req, res) {
  await requirePermission(req.user, req.params.id, "project:read");
  const items = await ProjectMember.find({ projectId: req.params.id })
    .populate("userId", "name email isActive");
  res.json({ items });
}

export async function listAvailableUsers(req, res) {
  await requirePermission(req.user, req.params.id, "member:manage");
  const memberIds = await ProjectMember.find({ projectId: req.params.id }).distinct("userId");
  const items = await User.find({
    isActive: true,
    _id: { $nin: memberIds },
  })
    .select("name email platformRole isActive")
    .sort({ name: 1 })
    .limit(100);
  res.json({ items });
}

export async function addMember(req, res) {
  if (req.user.platformRole !== "ADMIN") {
    await requirePermission(req.user, req.params.id, "member:manage");
  }
  requireFields(req.body, ["userId", "role"]);
  if (req.user.platformRole !== "ADMIN" && req.body.role !== "TEAM_MEMBER") {
    fail(403, "Project Managers can manually add Team Members only");
  }
  const user = await User.findById(validId(req.body.userId, "userId"));
  if (!user?.isActive) fail(404, "Active user not found");
  if (!PROJECT_ROLES.includes(req.body.role)) fail(400, "Invalid project role");
  if (await ProjectMember.exists({ projectId: req.params.id, userId: user._id })) {
    fail(409, "User is already a project member");
  }
  const member = await ProjectMember.create({ projectId: req.params.id, userId: user._id, role: req.body.role });
  await recordActivity(req.user._id, req.params.id, "project.member_added", "ProjectMember", member._id, { userId: user._id, role: member.role });
  await createNotification(user._id, "PROJECT_MEMBERSHIP", { projectId: req.params.id, role: member.role });
  emitToProject(req.params.id, "project.member_added", member);
  res.status(201).json({ member });
}

export async function assignProjectManager(req, res) {
  const projectId = validId(req.params.id, "project id");
  const userId = validId(req.params.userId, "user id");
  const [project, user] = await Promise.all([
    Project.findById(projectId).select("name status"),
    User.findById(userId),
  ]);
  if (!project) fail(404, "Project not found");
  if (project.status !== "ACTIVE") fail(409, "Cannot assign a manager to an archived project");
  if (!user?.isActive) fail(404, "Active user not found");
  const existing = await ProjectMember.findOne({ projectId, userId });
  const member = await ProjectMember.findOneAndUpdate(
    { projectId, userId },
    { role: "PROJECT_MANAGER" },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  );
  await recordActivity(
    req.user._id,
    projectId,
    existing ? "project.role_changed" : "project.member_added",
    "ProjectMember",
    member._id,
    { userId, role: member.role },
  );
  await createNotification(userId, existing ? "PROJECT_ROLE_CHANGED" : "PROJECT_MEMBERSHIP", {
    projectId: String(projectId),
    projectName: project.name,
    role: member.role,
  });
  emitToProject(projectId, existing ? "project.role_changed" : "project.member_added", member);
  res.json({ member });
}

export async function changeMemberRole(req, res) {
  await requirePermission(req.user, req.params.id, "member:manage");
  requireFields(req.body, ["role"]);
  if (!PROJECT_ROLES.includes(req.body.role)) fail(400, "Invalid project role");
  if (req.body.role === "PROJECT_MANAGER" && req.user.platformRole !== "ADMIN") {
    fail(403, "Only an Admin can appoint a Project Manager");
  }
  const userId = validId(req.params.userId, "user id");
  const member = await withMutationLock(`project-members:${req.params.id}`, async () => {
    const current = await ProjectMember.findOne({ projectId: req.params.id, userId });
    if (!current) fail(404, "Membership not found");
    if (current.role === "PROJECT_MANAGER" && req.user.platformRole !== "ADMIN") {
      fail(403, "Only an Admin can change a Project Manager's role");
    }
    if (current.role === "PROJECT_MANAGER" && req.body.role !== "PROJECT_MANAGER") {
      const managerCount = await ProjectMember.countDocuments({ projectId: req.params.id, role: "PROJECT_MANAGER" });
      if (managerCount <= 1) fail(409, "A project must always have at least one Project Manager");
    }
    current.role = req.body.role;
    return current.save();
  });
  await recordActivity(req.user._id, req.params.id, "project.role_changed", "ProjectMember", member._id, { role: member.role });
  await createNotification(member.userId, "PROJECT_ROLE_CHANGED", { projectId: req.params.id, role: member.role });
  emitToProject(req.params.id, "project.role_changed", member);
  res.json({ member });
}

export async function removeMember(req, res) {
  await requirePermission(req.user, req.params.id, "member:manage");
  const userId = validId(req.params.userId, "user id");
  const member = await withMutationLock(`project-members:${req.params.id}`, async () => {
    const current = await ProjectMember.findOne({ projectId: req.params.id, userId });
    if (!current) fail(404, "Membership not found");
    if (current.role === "PROJECT_MANAGER") {
      const managerCount = await ProjectMember.countDocuments({ projectId: req.params.id, role: "PROJECT_MANAGER" });
      if (managerCount <= 1) fail(409, "A project must always have at least one Project Manager");
    }
    await current.deleteOne();
    return current;
  });
  await recordActivity(req.user._id, req.params.id, "project.member_removed", "ProjectMember", member._id, { userId: member.userId });
  emitToProject(req.params.id, "project.member_removed", { userId: member.userId });
  res.status(204).end();
}
