import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "./db/db.js";
import { Project, ProjectMember, Task, User } from "./models/index.js";

const passwordHash = await bcrypt.hash(
  process.env.SEED_PASSWORD || "Password123!",
  12,
);
await connectDatabase();
async function user(name, email, platformRole) {
  return User.findOneAndUpdate(
    { email },
    {
      $set: { name, passwordHash, platformRole, isActive: true },
      $unset: { requestedRole: "" },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
}
const admin = await user("Admin User", "admin@neostats.local", "ADMIN");
const manager = await user("Project Manager", "manager@neostats.local", "USER");
const member = await user("Team Member", "member@neostats.local", "USER");
const viewer = await user("Viewer", "viewer@neostats.local", "USER");
let project = await Project.findOne({ name: "NeoStats Demo" });
if (!project)
  project = await Project.create({
    name: "NeoStats Demo",
    description: "Seeded demo project",
    markdownContent: "# NeoStats Demo",
    createdBy: admin._id,
  });
for (const [person, role] of [
  [manager, "PROJECT_MANAGER"],
  [member, "TEAM_MEMBER"],
  [viewer, "VIEWER"],
])
  await ProjectMember.findOneAndUpdate(
    { projectId: project._id, userId: person._id },
    { $set: { role }, $unset: { roleId: "" } },
    { upsert: true, returnDocument: "after" },
  );
if (
  !(await Task.exists({
    projectId: project._id,
    title: "Try optimistic task updates",
  }))
)
  await Task.create({
    projectId: project._id,
    title: "Try optimistic task updates",
    description: "Send version with every PATCH request.",
    assigneeId: member._id,
    createdBy: manager._id,
  });
console.log("Seed complete");
console.log("Password:", process.env.SEED_PASSWORD || "Password123!");
console.log(
  "Users: admin@neostats.local, manager@neostats.local, member@neostats.local, viewer@neostats.local",
);
await mongoose.disconnect();
