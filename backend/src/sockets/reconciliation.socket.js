// src/sockets/reconciliation.socket.js
// Handles real-time reconciliation events pushed to connected clients.
// The reconciliation service emits events here after processing each payment.

const initReconciliationSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Client joins a room scoped to their school
    socket.on('join:school', (schoolId) => {
      socket.join(`school:${schoolId}`);
      console.log(`📡 Socket ${socket.id} joined room school:${schoolId}`);
    });

    // Client joins a room scoped to a specific student (for parent portal)
    socket.on('join:student', (studentId) => {
      socket.join(`student:${studentId}`);
      console.log(`📡 Socket ${socket.id} joined room student:${studentId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

/**
 * Emits a reconciliation event to all clients in the school's room.
 * Called by the reconciliation service after processing a payment.
 *
 * @param {object} io         - Socket.io server instance
 * @param {string} schoolId   - School room to broadcast to
 * @param {object} eventData  - Payment and reconciliation details
 */
const emitReconciliationEvent = (io, schoolId, eventData) => {
  io.to(`school:${schoolId}`).emit('payment:reconciled', {
    ...eventData,
    timestamp: new Date().toISOString(),
  });

  // Also emit to parent's student room if studentId is present
  if (eventData.studentId) {
    io.to(`student:${eventData.studentId}`).emit('payment:reconciled', {
      ...eventData,
      timestamp: new Date().toISOString(),
    });
  }
};

module.exports = { initReconciliationSocket, emitReconciliationEvent };
