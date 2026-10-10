import ActivityLog from "../models/activity-log.js";

export function recordActivity(actorId, projectId, action, entityType, entityId, metadata = {}) {
  return ActivityLog.create({ actorId, projectId, action, entityType, entityId, metadata });
}
