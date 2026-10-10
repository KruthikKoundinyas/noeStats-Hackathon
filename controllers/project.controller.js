import Project from "../models/project.js";
import ProjectMember from "../models/project-member.js";
import AccessRequest from "../models/access-request.js";
import ActivityLog from "../models/activity-log.js";
import Comment from "../models/comment.js";
import Notification from "../models/notification.js";
import Task from "../models/task.js";
import { recordActivity } from "../services/activity.service.js";
import { createNotification } from "../services/notification.service.js";
import { hasPermission, requirePermission } from "../services/permission.service.js";
import { emitToProject } from "../services/realtime.service.js";
import { fail, matchField, patterns, requireFields, validId } from "../utils/http.js";

export async function listProjects(req, res) {
  const filter = req.user.platformRole === "ADMIN"
    ? {}
    : { _id: { $in: await ProjectMember.find({ userId: req.user._id }).distinct("projectId") } };
  if (req.query.status) filter.status = req.query.status;
  const items = await Project.find(filter).populate("createdBy", "name email").sort({ updatedAt: -1 });
  res.json({ items });
}

export async function createProject(req, res) {
  const canCreate = req.user.platformRole === "ADMIN" || await ProjectMember.exists({
    userId: req.user._id,
    role: "PROJECT_MANAGER",
  });
  if (!canCreate) fail(403, "Only an Admin or Project Manager can create projects");
  requireFields(req.body, ["name"]);
  const name = matchField(req.body.name, patterns.title, "project name");
  const project = await Project.create({
    name,
    description: req.body.description,
    markdownContent: req.body.markdownContent,
    createdBy: req.user._id,
  });
  try {
    await ProjectMember.create({ projectId: project._id, userId: req.user._id, role: "PROJECT_MANAGER" });
  } catch (error) {
    await project.deleteOne();
    throw error;
  }
  await recordActivity(req.user._id, project._id, "project.created", "Project", project._id);
  res.status(201).json({ project });
}

export async function getProject(req, res) {
  await requirePermission(req.user, req.params.id, "project:read");
  const project = await Project.findById(req.params.id)
    .populate("createdBy", "name email")
    .populate("notes.createdBy", "name email");
  if (!project) fail(404, "Project not found");
  res.json({ project });
}

export async function createProjectNote(req, res) {
  const canUpdateProject = await hasPermission(req.user, req.params.id, "project:update");
  const canUpdateNotes = await hasPermission(req.user, req.params.id, "project:notes:update");
  if (!canUpdateProject && !canUpdateNotes) fail(403, "Project note creation not permitted");
  if (typeof req.body.content !== "string" || !req.body.content.trim() || req.body.content.length > 20000) {
    fail(400, "Note must be between 1 and 20000 characters");
  }
  const project = await Project.findById(req.params.id);
  if (!project) fail(404, "Project not found");
  project.notes.push({ content: req.body.content.trim(), createdBy: req.user._id });
  await project.save();
  const note = project.notes[project.notes.length - 1];
  await recordActivity(req.user._id, project._id, "project.note_added", "Project", project._id, { noteId: note._id });
  const recipientIds = await ProjectMember.find({
    projectId: project._id,
    userId: { $ne: req.user._id },
  }).distinct("userId");
  await Promise.all(recipientIds.map((recipientId) => createNotification(
    recipientId,
    "PROJECT_NOTE_ADDED",
    {
      projectId: String(project._id),
      projectName: project.name,
      noteId: String(note._id),
      authorName: req.user.name,
    },
  )));
  await project.populate("notes.createdBy", "name email");
  emitToProject(project._id, "project.note_created", { projectId: project._id, note: project.notes.id(note._id) });
  res.status(201).json({ project });
}

export async function deleteProjectNote(req, res) {
  const project = await Project.findById(validId(req.params.id, "project id"));
  if (!project) fail(404, "Project not found");
  if (req.params.noteId === "legacy") {
    const canUpdateProject = await hasPermission(req.user, project._id, "project:update");
    const canUpdateNotes = await hasPermission(req.user, project._id, "project:notes:update");
    if (!canUpdateProject && !canUpdateNotes) fail(403, "Project note deletion not permitted");
    project.markdownContent = "";
    await project.save();
    emitToProject(project._id, "project.note_deleted", { projectId: project._id, noteId: "legacy" });
    return res.status(204).end();
  }
  const note = project.notes.id(validId(req.params.noteId, "note id"));
  if (!note) fail(404, "Note not found");
  const ownsNote = String(note.createdBy) === String(req.user._id);
  const canManage = await hasPermission(req.user, project._id, "member:manage");
  if (!ownsNote && !canManage) fail(403, "Only the note author or a Project Manager can delete this note");
  const noteId = note._id;
  project.notes.pull(note._id);
  await project.save();
  await recordActivity(req.user._id, project._id, "project.note_deleted", "Project", project._id, { noteId });
  emitToProject(project._id, "project.note_deleted", { projectId: project._id, noteId });
  res.status(204).end();
}

export async function updateProject(req, res) {
  const canUpdateProject = await hasPermission(req.user, req.params.id, "project:update");
  const canUpdateNotes = await hasPermission(req.user, req.params.id, "project:notes:update");
  if (!canUpdateProject && !canUpdateNotes) fail(403, "Project update not permitted");
  if (!canUpdateProject && Object.keys(req.body).some((key) => key !== "markdownContent")) {
    fail(403, "Team Members can only update project notes");
  }
  const allowed = canUpdateProject
    ? ["name", "description", "markdownContent"]
    : ["markdownContent"];
  const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (Object.keys(update).length === 0) fail(400, "No supported project fields provided");
  if (update.name !== undefined) update.name = matchField(update.name, patterns.title, "project name");
  const project = await Project.findByIdAndUpdate(req.params.id, update, { returnDocument: "after", runValidators: true });
  if (!project) fail(404, "Project not found");
  await recordActivity(req.user._id, project._id, "project.updated", "Project", project._id, update);
  emitToProject(project._id, "project.updated", project);
  res.json({ project });
}

export async function archiveProject(req, res) {
  const project = await Project.findByIdAndUpdate(validId(req.params.id), { status: "ARCHIVED" }, { returnDocument: "after" });
  if (!project) fail(404, "Project not found");
  await recordActivity(req.user._id, project._id, "project.archived", "Project", project._id);
  emitToProject(project._id, "project.updated", project);
  res.json({ project });
}

export async function deleteProject(req, res) {
  const projectId = validId(req.params.id, "project id");
  const project = await Project.findById(projectId);
  if (!project) fail(404, "Project not found");
  const isCreator = String(project.createdBy) === String(req.user._id);
  const isAdmin = req.user.platformRole === "ADMIN";
  const isProjectManager = await ProjectMember.exists({
    projectId,
    userId: req.user._id,
    role: "PROJECT_MANAGER",
  });
  if (!isAdmin && !isCreator && !isProjectManager) {
    fail(403, "Only an Admin, the project creator, or a Project Manager can delete this project");
  }

  const taskIds = await Task.find({ projectId }).distinct("_id");
  await Promise.all([
    Comment.deleteMany({ taskId: { $in: taskIds } }),
    Task.deleteMany({ projectId }),
    ProjectMember.deleteMany({ projectId }),
    AccessRequest.deleteMany({ projectId }),
    ActivityLog.deleteMany({ projectId }),
    Notification.deleteMany({
      "payload.projectId": { $in: [projectId, String(projectId)] },
    }),
  ]);
  await project.deleteOne();
  emitToProject(projectId, "project.deleted", { projectId: String(projectId) });
  res.status(204).end();
}
