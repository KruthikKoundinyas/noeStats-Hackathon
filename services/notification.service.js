import Notification from "../models/notification.js";
import { emitToUser } from "./realtime.service.js";

export async function createNotification(recipientId, type, payload) {
  const notification = await Notification.create({ recipientId, type, payload });
  emitToUser(recipientId, "notification.created", notification);
  return notification;
}
