import ActivityLog from "../models/activity-log.js";
import { requirePermission } from "../services/permission.service.js";

export async function listActivity(req, res) {
  await requirePermission(req.user, req.params.id, "activity:read");
  const items = await ActivityLog.find({ projectId: req.params.id })
    .populate("actorId", "name email")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ items });
}
