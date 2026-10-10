import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    platformRole: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { transform: (_, value) => { delete value.passwordHash; return value; } } },
);

export default mongoose.model("User", userSchema);
