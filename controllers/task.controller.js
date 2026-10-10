import Comment from "../models/comment.js";
import ProjectMember from "../models/project-member.js";
import Task from "../models/task.js";
import { recordActivity } from "../services/activity.service.js";
import { createNotification } from "../services/notification.service.js";
import { hasPermission, requirePermission } from "../services/permission.service.js";
import { emitToProject } from "../services/realtime.service.js";
import { fail, matchField, patterns, requireFields, validId } from "../utils/http.js";

export async function listTasks(req, res) {
  await requirePermission(req.user, req.params.id, "task:read");
  const filter = { projectId: req.params.id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assigneeId) filter.assigneeId = req.query.assigneeId;
  const items = await Task.find(filter).populate("assigneeId", "name email").sort({ updatedAt: -1 });
  res.json({ items });
}

export async function createTask(req, res) {
  await requirePermission(req.user, req.params.id, "task:create");
  requireFields(req.body, ["title"]);
  const title = matchField(req.body.title, patterns.title, "task title");
  if (req.body.assigneeId && !(await ProjectMember.exists({ projectId: req.params.id, userId: validId(req.body.assigneeId, "assigneeId") }))) {
    fail(400, "Assignee is not a project member");
  }
  const task = await Task.create({
    title,
    description: req.body.description,
    status: req.body.status,
    assigneeId: req.body.assigneeId,
    projectId: req.params.id,
    createdBy: req.user._id,
  });
  await recordActivity(req.user._id, req.params.id, "task.created", "Task", task._id);
  if (task.assigneeId) await createNotification(task.assigneeId, "TASK_ASSIGNED", { projectId: req.params.id, taskId: task._id, title: task.title });
  emitToProject(req.params.id, "task.created", task);
  res.status(201).json({ task });
}

export async function getTask(req, res) {
  const task = await Task.findById(validId(req.params.id)).populate("assigneeId", "name email");
  if (!task) fail(404, "Task not found");
  await requirePermission(req.user, task.projectId, "task:read");
  res.json({ task });
}

export async function updateTask(req, res) {
  requireFields(req.body, ["version"]);
  const current = await Task.findById(validId(req.params.id));
  if (!current) fail(404, "Task not found");
  const fullUpdate = await hasPermission(req.user, current.projectId, "task:update");
  const assignedUpdate = await hasPermission(req.user, current.projectId, "task:update:assigned")
    && String(current.assigneeId) === String(req.user._id);
  if (!fullUpdate && !assignedUpdate) fail(403, "Task update not permitted");
  const allowed = fullUpdate ? ["title", "description", "status", "assigneeId"] : ["status"];
  const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (update.title !== undefined) update.title = matchField(update.title, patterns.title, "task title");
  if (update.assigneeId && !(await ProjectMember.exists({ projectId: current.projectId, userId: update.assigneeId }))) {
    fail(400, "Assignee is not a project member");
  }
  const task = await Task.findOneAndUpdate(
    { _id: current._id, version: Number(req.body.version) },
    { $set: update, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true },
  );
  if (!task) fail(409, "Task was changed by another user", { latest: await Task.findById(current._id) });
  const action = update.status && update.status !== current.status
    ? "task.status_changed"
    : update.assigneeId && String(update.assigneeId) !== String(current.assigneeId)
      ? "task.assigned" : "task.updated";
  await recordActivity(req.user._id, task.projectId, action, "Task", task._id, update);
  if (update.assigneeId && String(update.assigneeId) !== String(current.assigneeId)) {
    await createNotification(update.assigneeId, "TASK_ASSIGNED", { projectId: task.projectId, taskId: task._id, title: task.title });
  }
  if (action === "task.status_changed" && String(task.createdBy) !== String(req.user._id)) {
    await createNotification(task.createdBy, "TASK_STATUS_CHANGED", { projectId: task.projectId, taskId: task._id, status: task.status });
  }
  emitToProject(task.projectId, action, task);
  res.json({ task });
}

export async function deleteTask(req, res) {
  const task = await Task.findById(validId(req.params.id));
  if (!task) fail(404, "Task not found");
  await requirePermission(req.user, task.projectId, "task:delete");
  await Comment.deleteMany({ taskId: task._id });
  await task.deleteOne();
  await recordActivity(req.user._id, task.projectId, "task.deleted", "Task", task._id);
  emitToProject(task.projectId, "task.deleted", { taskId: task._id });
  res.status(204).end();
}
