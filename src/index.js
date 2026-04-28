// BigInt.prototype.toJSON = function() {
//   return this.toString();
// };

import { createServer } from 'node:http';
import { app } from './api/server.js';
import config from './config/env.config.js';
import prisma from './infrastructure/database/prisma.client.js';
import { timeoutService } from './modules/orders/timeout.service.js';
import { socketManager } from './infrastructure/websockets/socket.manager.js';

// Create native HTTP server wrapping the Express app
const server = createServer(app);
// Initialize WebSocket server with the same HTTP server
socketManager.initialize(server);

// Bootstrap Function
const startServer = async () => {
  try {
    // Ensure Database Connection is viable before accepting traffic
    await prisma.$connect();
    console.log('✅ Database connection established successfully.');
    timeoutService.sweepOrphanedOrders().catch(console.error);

    server.listen(config.PORT, () => {
      console.log(`🚀 ASTU Eats Backend running in ${config.NODE_ENV} mode on port ${config.PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();

// ==========================================
// Graceful Shutdown & Process Management
// ==========================================

const shutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
  
  server.close(async () => {
    console.log('🛑 HTTP server closed. No longer accepting new connections.');
    try {
      await prisma.$disconnect();
      console.log('✅ Prisma database connection closed.');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during Prisma disconnection:', error);
      process.exit(1);
    }
  });

  // Force shutdown if graceful shutdown takes too long (e.g., 10 seconds)
  setTimeout(() => {
    console.error('❌ Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

// Listen for termination signals from the OS/Docker
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT')); 

// Catch unhandled process exceptions (Safety net outside Express)
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception! Shutting down...', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('🔥 Unhandled Rejection! Shutting down...', reason);
  shutdown('unhandledRejection');
}); 