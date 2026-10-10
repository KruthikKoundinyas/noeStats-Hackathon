export function notFound(_req, _res, next) {
  next(Object.assign(new Error("Route not found"), { status: 404 }));
}

export function errorHandler(error, _req, res, _next) {
  if (error.code === 11000) {
    return res.status(409).json({ error: "A record with that value already exists", fields: error.keyValue });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ error: error.message });
  }
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || "Internal server error",
    ...(error.details && { details: error.details }),
  });
}
