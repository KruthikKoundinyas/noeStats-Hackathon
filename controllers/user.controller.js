import bcrypt from "bcryptjs";
import User from "../models/user.js";
import { revokeUserSessions } from "../services/session.service.js";
import { fail, matchField, patterns, requireFields, validId } from "../utils/http.js";

export async function listUsers(req, res) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const filter = req.query.active === undefined ? {} : { isActive: req.query.active === "true" };
  const [items, total] = await Promise.all([
    User.find(filter).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total });
}

export async function createUser(req, res) {
  requireFields(req.body, ["name", "email", "password"]);
  const name = matchField(req.body.name, patterns.humanName, "name");
  const email = matchField(String(req.body.email).toLowerCase(), patterns.email, "email");
  if (String(req.body.password).length < 8) fail(400, "Password must be at least 8 characters");
  if (await User.exists({ email })) fail(409, "Email already registered");
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    platformRole: req.body.platformRole === "ADMIN" ? "ADMIN" : "USER",
  });
  res.status(201).json({ user });
}

export async function getUser(req, res) {
  const user = await User.findById(validId(req.params.id));
  if (!user) fail(404, "User not found");
  res.json({ user });
}

export async function updateUser(req, res) {
  if (req.user.platformRole !== "ADMIN" && String(req.user._id) !== req.params.id) {
    fail(403, "Cannot update another user");
  }
  const update = req.body.name === undefined ? {} : { name: matchField(req.body.name, patterns.humanName, "name") };
  const user = await User.findByIdAndUpdate(validId(req.params.id), update, { returnDocument: "after", runValidators: true });
  if (!user) fail(404, "User not found");
  res.json({ user });
}

export async function changePlatformRole(req, res) {
  if (!["USER", "ADMIN"].includes(req.body.platformRole)) fail(400, "platformRole must be USER or ADMIN");
  const user = await User.findByIdAndUpdate(validId(req.params.id), { platformRole: req.body.platformRole }, { returnDocument: "after" });
  if (!user) fail(404, "User not found");
  res.json({ user });
}

export async function deactivateUser(req, res) {
  const user = await User.findByIdAndUpdate(validId(req.params.id), { isActive: false }, { returnDocument: "after" });
  if (!user) fail(404, "User not found");
  revokeUserSessions(req.params.id);
  res.json({ user });
}
