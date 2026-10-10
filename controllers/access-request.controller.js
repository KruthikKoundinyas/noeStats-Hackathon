import AccessRequest from "../models/access-request.js";
import Project from "../models/project.js";
import ProjectMember from "../models/project-member.js";
import { recordActivity } from "../services/activity.service.js";
import { createNotification } from "../services/notification.service.js";
import { withMutationLock } from "../services/mutation-lock.service.js";
import { requirePermission } from "../services/permission.service.js";
import { emitToProject } from "../services/realtime.service.js";
import { fail, requireFields, validId } from "../utils/http.js";

export async function discoverProjects(req, res) {
  const [projects, memberships, requests] = await Promise.all([
    Project.find({ status: "ACTIVE" }).select("name description status createdBy updatedAt").sort({ updatedAt: -1 }),
    ProjectMember.find({ userId: req.user._id }).select("projectId role"),
    AccessRequest.find({ userId: req.user._id }).select("projectId requestedRole status"),
  ]);
  const memberByProject = new Map(memberships.map((item) => [String(item.projectId), item.role]));
  const requestByProject = new Map(requests.map((item) => [String(item.projectId), item]));
  res.json({ items: projects.map((project) => ({
    ...project.toObject(),
    membershipRole: memberByProject.get(String(project._id)) || null,
    accessRequest: requestByProject.get(String(project._id)) || null,
  })) });
}

export async function requestAccess(req, res) {
  requireFields(req.body, ["requestedRole"]);
  validId(req.params.id, "project id");
  if (!["TEAM_MEMBER", "VIEWER"].includes(req.body.requestedRole)) fail(400, "requestedRole must be TEAM_MEMBER or VIEWER");
  const project = await Project.findOne({ _id: req.params.id, status: "ACTIVE" }).select("name createdBy");
  if (!project) fail(404, "Active project not found");
  if (await ProjectMember.exists({ projectId: req.params.id, userId: req.user._id })) fail(409, "Already a project member");
  const existing = await AccessRequest.findOne({ projectId: req.params.id, userId: req.user._id });
  if (existing?.status === "PENDING") fail(409, "Access request is already pending");
  const accessRequest = await AccessRequest.findOneAndUpdate(
    { projectId: req.params.id, userId: req.user._id },
    { requestedRole: req.body.requestedRole, status: "PENDING", reviewedBy: null, reviewedAt: null },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  const managers = await ProjectMember.find({
    projectId: req.params.id,
    role: "PROJECT_MANAGER",
  }).distinct("userId");
  const recipients = new Set([
    ...managers.map(String),
    String(project.createdBy),
  ]);
  recipients.delete(String(req.user._id));
  await Promise.all(
    [...recipients].map((recipientId) =>
      createNotification(recipientId, "PROJECT_ACCESS_REQUESTED", {
        projectId: req.params.id,
        projectName: project.name,
        requestId: accessRequest._id,
        requesterId: req.user._id,
        requesterName: req.user.name,
        requestedRole: accessRequest.requestedRole,
      }),
    ),
  );
  emitToProject(req.params.id, "project.access_requested", accessRequest);
  res.status(201).json({ accessRequest });
}

export async function cancelAccessRequest(req, res) {
  const accessRequest = await AccessRequest.findOneAndUpdate(
    { projectId: validId(req.params.id, "project id"), userId: req.user._id, status: "PENDING" },
    { status: "CANCELLED" },
    { returnDocument: "after" },
  );
  if (!accessRequest) fail(404, "Pending access request not found");
  res.json({ accessRequest });
}

export async function listAccessRequests(req, res) {
  await requirePermission(req.user, req.params.id, "member:manage");
  const filter = { projectId: req.params.id };
  if (req.query.status) filter.status = req.query.status;
  const items = await AccessRequest.find(filter).populate("userId", "name email").sort({ createdAt: -1 });
  res.json({ items });
}

export async function reviewAccessRequest(req, res) {
  await requirePermission(req.user, req.params.id, "member:manage");
  requireFields(req.body, ["status"]);
  if (!["APPROVED", "REJECTED"].includes(req.body.status)) fail(400, "status must be APPROVED or REJECTED");
  const project = await Project.findById(validId(req.params.id, "project id")).select("name");
  if (!project) fail(404, "Project not found");
  const requestId = validId(req.params.requestId, "request id");
  const accessRequest = await withMutationLock(`access-request:${requestId}`, async () => {
    const current = await AccessRequest.findOne({ _id: requestId, projectId: req.params.id, status: "PENDING" });
    if (!current) fail(404, "Pending access request not found");
    if (req.body.status === "APPROVED") {
      const role = req.body.role || current.requestedRole;
      if (!["TEAM_MEMBER", "VIEWER"].includes(role)) fail(400, "Approved role must be TEAM_MEMBER or VIEWER");
      await ProjectMember.create({ projectId: req.params.id, userId: current.userId, role });
      await recordActivity(req.user._id, req.params.id, "project.member_added", "ProjectMember", current._id, { userId: current.userId, role });
    }
    current.status = req.body.status;
    current.reviewedBy = req.user._id;
    current.reviewedAt = new Date();
    return current.save();
  });
  const membership = accessRequest.status === "APPROVED"
    ? await ProjectMember.findOne({ projectId: req.params.id, userId: accessRequest.userId }).select("role")
    : null;
  await createNotification(accessRequest.userId, `PROJECT_ACCESS_${accessRequest.status}`, {
    projectId: req.params.id,
    projectName: project.name,
    ...(membership ? { role: membership.role } : {}),
  });
  emitToProject(req.params.id, "project.access_reviewed", accessRequest);
  res.json({ accessRequest });
}
