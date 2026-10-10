import Notification from "../models/notification.js";
import { fail, validId } from "../utils/http.js";

export async function listNotifications(req, res) {
  const filter = { recipientId: req.user._id };
  if (req.query.unread === "true") filter.readAt = null;
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({ items });
}

export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: validId(req.params.id), recipientId: req.user._id },
    { readAt: new Date() },
    { returnDocument: "after" },
  );
  if (!notification) fail(404, "Notification not found");
  res.json({ notification });
}

export async function markAllNotificationsRead(req, res) {
  const result = await Notification.updateMany(
    { recipientId: req.user._id, readAt: null },
    { readAt: new Date() },
  );
  res.json({ updated: result.modifiedCount });
}

export async function deleteReadNotifications(req, res) {
  const result = await Notification.deleteMany({
    recipientId: req.user._id,
    readAt: { $ne: null },
  });
  res.json({ deleted: result.deletedCount });
}
