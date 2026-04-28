import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../../config/env.config.js';
import prisma from '../database/prisma.client.js';

class SocketManager {
  constructor() {
    this.io = null;
    // In-memory map: userId -> socketId
    // For a multi-server setup (Phase 6), this would be moved to a Redis adapter
    this.connectedDeliverers = new Map();
    this.connectedCustomers = new Map();
  }

  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000, // 60 seconds
    });

    // 1. Socket Authentication Middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
        if (!token) return next(new Error('UNAUTHORIZED: No token provided'));

        const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);

        // Security: Ensure user is still active in the database
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { status: true, role: true, activeMode: true }
        });

        if (!user || user.status !== 'ACTIVE') {
          return next(new Error('UNAUTHORIZED: User banned or inactive'));
        }

        // Attach verified data to the persistent socket session
        socket.userId = decoded.id;
        socket.role = user.role;
        socket.activeMode = user.activeMode;
        next();
      } catch (error) {
        return next(new Error('UNAUTHORIZED: Invalid token'));
      }
    });

    // 2. Connection Handlers
    this.io.on('connection', (socket) => {
      console.log(`🟢 [WS CONNECTED] User: ${socket.userId} | Mode: ${socket.activeMode}`);

      // Track active deliverers for targeted broadcasts
      if (socket.activeMode === 'DELIVERER') {
        this.connectedDeliverers.set(socket.userId, socket.id);
        // Join a general 'deliverers' room for system-wide alerts
        socket.join('active_deliverers');
      } else {
        this.connectedCustomers.set(socket.userId, socket.id);
        // Customers join a specific room for their own order tracking
        // They will emit a 'track_order' event from the frontend to join 'order_AE-1234'
      }

      // Handle explicit order tracking requests from the frontend
      socket.on('track_order', (orderId) => {
        socket.join(`order_${orderId}`);
        console.log(`📍 User ${socket.userId} is tracking order ${orderId}`);
      });

      // Cleanup on disconnect
      socket.on('disconnect', () => {
        console.log(`🔴 [WS DISCONNECTED] User: ${socket.userId}`);
        if (socket.activeMode === 'DELIVERER') {
          this.connectedDeliverers.delete(socket.userId);
        } else {
          this.connectedCustomers.delete(socket.userId);
        }
      });
    });
  }

  // Helper method to push data to a specific order room (For Order Status Tracking)
  emitOrderUpdate(orderId, eventName, payload) {
    if (this.io) {
      this.io.to(`order_${orderId}`).emit(eventName, payload);
    }
  }

  // Helper method to push data to a specific Deliverer (For direct notifications)
  emitToDeliverer(delivererId, eventName, payload) {
    const socketId = this.connectedDeliverers.get(delivererId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(eventName, payload);
    }
  }
}

// Export singleton instance
export const socketManager = new SocketManager();