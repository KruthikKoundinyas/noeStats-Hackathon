import mongoose from "mongoose";

export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  humanName: /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'_-]{1,79}$/u,
  title: /^[^\r\n<>]{2,120}$/u,
};

export function fail(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  throw error;
}

export function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === "");
  if (missing.length) fail(400, `Missing required fields: ${missing.join(", ")}`);
}

export function validId(value, label = "id") {
  if (!mongoose.isValidObjectId(value)) fail(400, `Invalid ${label}`);
  return value;
}

export function matchField(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value.trim())) {
    fail(400, `Invalid ${label}`);
  }
  return value.trim();
}
