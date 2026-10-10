let socketServer;

export function setSocketServer(io) {
  socketServer = io;
}

export function emitToProject(projectId, event, payload) {
  socketServer?.to(`project:${projectId}`).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  socketServer?.to(`user:${userId}`).emit(event, payload);
}
