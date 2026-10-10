import { Router } from "express";
import { createComment, listComments } from "../controllers/comment.controller.js";
import { deleteTask, getTask, updateTask } from "../controllers/task.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();
router.use(authenticate);
router.get("/:id", getTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);
router.get("/:id/comments", listComments);
router.post("/:id/comments", createComment);
export default router;
