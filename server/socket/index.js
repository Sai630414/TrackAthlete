/**
 * Socket.IO event wiring for TrackAthlete
 * Handles: user rooms, connection rooms, notifications, and real-time chat
 */
function initSocket(io) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query?.userId;

    // Join personal room so we can target notifications to specific users
    if (userId) {
      socket.join(userId);
      console.log(`Socket connected: ${socket.id} (user: ${userId})`);
    } else {
      console.log(`Socket connected: ${socket.id} (anonymous)`);
    }

    // Join a shared connection room for chat (both coach and athlete join the same room)
    socket.on('join-connection-room', (connectionId) => {
      if (connectionId) {
        socket.join(connectionId);
        console.log(`Socket ${socket.id} joined connection room: ${connectionId}`);
      }
    });

    // Leave a connection room
    socket.on('leave-connection-room', (connectionId) => {
      if (connectionId) {
        socket.leave(connectionId);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = initSocket;
