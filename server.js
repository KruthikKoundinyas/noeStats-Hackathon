import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/db.js";
import { configureSocket } from "./realtime/socket.js";
import { sessions } from "./services/session.service.js";
import { migrateLegacyMemberships } from "./services/membership-migration.service.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.frontendOrigin, credentials: true },
});
configureSocket(io);

export async function startServer() {
  await connectDatabase();
  await migrateLegacyMemberships();
  const listen = (port) => new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      console.log(`NeoStats API listening on http://localhost:${port}`);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });

  try {
    return await listen(env.port);
  } catch (error) {
    if (error.code !== "EADDRINUSE" || env.port === env.fallbackPort) throw error;
    console.warn(`Port ${env.port} is in use; retrying on ${env.fallbackPort}.`);
    return listen(env.fallbackPort);
  }
}

if (!env.isTest) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { app, io, server, sessions };
