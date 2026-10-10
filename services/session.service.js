import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE, env } from "../config/env.js";

export const sessions = new Map();
const revokedSessions = new Set();

export function createSession(res, user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: String(user._id), jti }, env.jwtSecret, { expiresIn: "8h" });
  sessions.set(jti, String(user._id));
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
  });
  return token;
}

export function revokeSession(jti) {
  sessions.delete(jti);
  revokedSessions.add(jti);
}

export function revokeUserSessions(userId) {
  for (const [jti, sessionUserId] of sessions) {
    if (sessionUserId === String(userId)) {
      sessions.delete(jti);
      revokedSessions.add(jti);
    }
  }
}

export function verifySessionToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  const trackedUserId = sessions.get(payload.jti);
  if (revokedSessions.has(payload.jti) || (trackedUserId && trackedUserId !== payload.sub)) {
    const error = new Error("Session expired or revoked");
    error.status = 401;
    throw error;
  }
  return payload;
}
