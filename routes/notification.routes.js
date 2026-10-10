import { Router } from "express";
import { deleteReadNotifications, listNotifications, markAllNotificationsRead, markNotificationRead } from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();
router.use(authenticate);
router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.delete("/read", deleteReadNotifications);
router.patch("/:id/read", markNotificationRead);
export default router;
