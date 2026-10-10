import mongoose from "mongoose";
import { PROJECT_ROLES } from "../config/permissions.js";

const projectMemberSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: PROJECT_ROLES, required: true },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
export default mongoose.model("ProjectMember", projectMemberSchema);
