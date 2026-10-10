import { AUTH_COOKIE } from "../config/env.js";
import User from "../models/user.js";
import { hasPermission, requirePermission } from "../services/permission.service.js";
import { setSocketServer } from "../services/realtime.service.js";
import { verifySessionToken } from "../services/session.service.js";

function cookieToken(socket) {
  const rawCookie = socket.handshake.headers.cookie || "";
  return rawCookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${AUTH_COOKIE}=`))
    ?.slice(AUTH_COOKIE.length + 1);
}

export function configureSocket(io) {
  setSocketServer(io);
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || cookieToken(socket);
      const payload = verifySessionToken(token);
      const user = await User.findById(payload.sub);
      if (!user?.isActive) throw new Error();
      socket.user = user;
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user._id}`);
    socket.on("project:join", async (projectId, done = () => {}) => {
      try {
        await requirePermission(socket.user, projectId, "project:read");
        await socket.join(`project:${projectId}`);
        done({ ok: true });
      } catch (error) {
        done({ ok: false, error: error.message });
      }
    });
    socket.on("project:markdown_change", async ({ projectId, content } = {}) => {
      try {
        if (typeof content !== "string" || content.length > 20000) return;
        const canUpdateProject = await hasPermission(socket.user, projectId, "project:update");
        const canUpdateNotes = await hasPermission(socket.user, projectId, "project:notes:update");
        if (!canUpdateProject && !canUpdateNotes) return;
        socket.to(`project:${projectId}`).emit("project:markdown_change", {
          projectId,
          content,
          userId: String(socket.user._id),
          userName: socket.user.name,
        });
      } catch {
        // Invalid or unauthorized draft updates are ignored.
      }
    });
  });
}
