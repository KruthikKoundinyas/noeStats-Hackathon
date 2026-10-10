import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  fallbackPort: 4000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || "development-only-change-me",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  isProduction,
  isTest: process.env.NODE_ENV === "test",
};

export const AUTH_COOKIE = "neostats_token";
