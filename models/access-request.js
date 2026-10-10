import mongoose from "mongoose";

const accessRequestSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  requestedRole: { type: String, enum: ["TEAM_MEMBER", "VIEWER"], required: true },
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"], default: "PENDING" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

accessRequestSchema.index({ projectId: 1, userId: 1 }, { unique: true });
export default mongoose.model("AccessRequest", accessRequestSchema);
