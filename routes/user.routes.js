import { Router } from "express";
import { changePlatformRole, createUser, deactivateUser, getUser, listUsers, updateUser } from "../controllers/user.controller.js";
import { adminOnly, authenticate } from "../middleware/authenticate.js";

const router = Router();
router.use(authenticate);
router.get("/", adminOnly, listUsers);
router.post("/", adminOnly, createUser);
router.get("/:id", adminOnly, getUser);
router.patch("/:id", updateUser);
router.patch("/:id/role", adminOnly, changePlatformRole);
router.patch("/:id/deactivate", adminOnly, deactivateUser);
export default router;
