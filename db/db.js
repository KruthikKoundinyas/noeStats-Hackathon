import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(uri = env.mongoUri) {
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);
  console.log("MongoDB connected");
}
