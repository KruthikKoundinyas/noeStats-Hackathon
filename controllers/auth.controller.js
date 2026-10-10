import bcrypt from "bcryptjs";
import { AUTH_COOKIE } from "../config/env.js";
import User from "../models/user.js";
import { createSession, revokeSession } from "../services/session.service.js";
import { getUserProjects } from "../services/user-project.service.js";
import { fail, matchField, patterns, requireFields } from "../utils/http.js";
import { publicUser } from "../utils/user.js";

export async function register(req, res) {
  requireFields(req.body, ["name", "email", "password"]);
  const name = matchField(req.body.name, patterns.humanName, "name");
  const email = matchField(String(req.body.email).toLowerCase(), patterns.email, "email");
  if (String(req.body.password).length < 8)
    fail(400, "Password must be at least 8 characters");
  if (await User.exists({ email })) fail(409, "Email already registered");
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(req.body.password, 12),
  });
  createSession(res, user);
  res.status(201).json({ user: { ...publicUser(user), projects: [] } });
}

export async function login(req, res) {
  requireFields(req.body, ["email", "password"]);
  const email = matchField(String(req.body.email).toLowerCase(), patterns.email, "email");
  const user = await User.findOne({ email }).select("+passwordHash");
  if (
    !user ||
    !user.isActive ||
    !(await bcrypt.compare(req.body.password, user.passwordHash))
  ) {
    fail(401, "Invalid email or password");
  }
  const projects = await getUserProjects(user._id);
  createSession(res, user);
  res.json({ user: { ...publicUser(user), projects } });
}

export function logout(req, res) {
  revokeSession(req.auth.jti);
  res.clearCookie(AUTH_COOKIE);
  res.status(204).end();
}

export async function me(req, res) {
  const projects = await getUserProjects(req.user._id);
  res.json({ user: { ...publicUser(req.user), projects } });
}
