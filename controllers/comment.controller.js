import Comment from "../models/comment.js";
import Task from "../models/task.js";
import { recordActivity } from "../services/activity.service.js";
import { createNotification } from "../services/notification.service.js";
import { hasPermission, requirePermission } from "../services/permission.service.js";
import { emitToProject } from "../services/realtime.service.js";
import { fail, requireFields, validId } from "../utils/http.js";

export async function listComments(req, res) {
  const task = await Task.findById(validId(req.params.id));
  if (!task) fail(404, "Task not found");
  await requirePermission(req.user, task.projectId, "task:read");
  const items = await Comment.find({ taskId: task._id }).populate("userId", "name email").sort({ createdAt: 1 });
  res.json({ items });
}

export async function createComment(req, res) {
  const task = await Task.findById(validId(req.params.id));
  if (!task) fail(404, "Task not found");
  await requirePermission(req.user, task.projectId, "comment:create");
  requireFields(req.body, ["content"]);
  if (typeof req.body.content !== "string" || !req.body.content.trim() || req.body.content.length > 5000) {
    fail(400, "Comment must be between 1 and 5000 characters");
  }
  const comment = await Comment.create({ taskId: task._id, userId: req.user._id, content: req.body.content });
  await recordActivity(req.user._id, task.projectId, "comment.added", "Comment", comment._id, { taskId: task._id });
  if (task.assigneeId && String(task.assigneeId) !== String(req.user._id)) {
    await createNotification(task.assigneeId, "TASK_COMMENT", { projectId: task.projectId, taskId: task._id, commentId: comment._id });
  }
  emitToProject(task.projectId, "comment.created", comment);
  res.status(201).json({ comment });
}

export async function deleteComment(req, res) {
  const comment = await Comment.findById(validId(req.params.id));
  if (!comment) fail(404, "Comment not found");
  const task = await Task.findById(comment.taskId);
  const ownsComment = String(comment.userId) === String(req.user._id);
  if (!ownsComment && !(await hasPermission(req.user, task.projectId, "comment:delete"))) {
    fail(403, "Comment delete not permitted");
  }
  await comment.deleteOne();
  emitToProject(task.projectId, "comment.deleted", { commentId: comment._id, taskId: task._id });
  res.status(204).end();
}
