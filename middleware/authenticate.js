import { AUTH_COOKIE } from "../config/env.js";
import User from "../models/user.js";
import { verifySessionToken } from "../services/session.service.js";
import { fail } from "../utils/http.js";

export function tokenFromRequest(req) {
  return req.cookies?.[AUTH_COOKIE] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
}

export async function authenticate(req, _res, next) {
  try {
    const token = tokenFromRequest(req);
    if (!token) fail(401, "Authentication required");
    const payload = verifySessionToken(token);
    const user = await User.findById(payload.sub);
    if (!user?.isActive) fail(401, "Account is inactive");
    req.user = user;
    req.auth = payload;
    next();
  } catch (error) {
    next(error.status ? error : Object.assign(new Error("Invalid or expired token"), { status: 401 }));
  }
}

export function adminOnly(req, _res, next) {
  if (req.user.platformRole === "ADMIN") return next();
  next(Object.assign(new Error("Admin access required"), { status: 403 }));
}
