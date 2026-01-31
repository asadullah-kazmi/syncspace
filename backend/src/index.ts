import express, { Application } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { connectDB } from './config/database';
import User from './models/user.model';
import DocumentModel from './models/document.model';
import mongoose from 'mongoose';

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };

    // Fetch user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user to socket
    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid or expired token'));
  }
});

// Track document presence: documentId -> Set<{ socketId, userId, userName, email }>
const documentPresence = new Map<
  string,
  Map<string, { userId: string; userName: string; email: string }>
>();

// Socket.IO connection handler
io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`✅ User connected: ${user.email} (${socket.id})`);

  // Join document room
  socket.on('join-document', async (documentId: string, callback) => {
    try {
      // Validate document ID
      if (!mongoose.Types.ObjectId.isValid(documentId)) {
        return callback?.({ success: false, error: 'Invalid document ID' });
      }

      // Check if user has access to this document
      const document = await DocumentModel.findOne({
        _id: documentId,
        $or: [{ ownerId: user._id }, { 'collaborators.userId': user._id }],
      });

      if (!document) {
        return callback?.({
          success: false,
          error: 'Document not found or access denied',
        });
      }

      // Join the room
      socket.join(`document:${documentId}`);

      // Track presence
      if (!documentPresence.has(documentId)) {
        documentPresence.set(documentId, new Map());
      }
      const presenceMap = documentPresence.get(documentId)!;
      presenceMap.set(socket.id, {
        userId: user._id.toString(),
        userName: user.email.split('@')[0],
        email: user.email,
      });

      // Get current users in room
      const usersInRoom = Array.from(presenceMap.values());

      // Notify others in the room
      socket.to(`document:${documentId}`).emit('user-joined', {
        userId: user._id.toString(),
        userName: user.email.split('@')[0],
        email: user.email,
      });

      console.log(`📄 ${user.email} joined document ${documentId}`);

      // Send success response with current users
      callback?.({ success: true, users: usersInRoom });
    } catch (error) {
      console.error('Error joining document:', error);
      callback?.({ success: false, error: 'Failed to join document' });
    }
  });

  // Leave document room
  socket.on('leave-document', (documentId: string) => {
    socket.leave(`document:${documentId}`);

    // Remove from presence tracking
    const presenceMap = documentPresence.get(documentId);
    if (presenceMap) {
      presenceMap.delete(socket.id);
      if (presenceMap.size === 0) {
        documentPresence.delete(documentId);
      }
    }

    // Notify others
    socket.to(`document:${documentId}`).emit('user-left', {
      userId: user._id.toString(),
      userName: user.email.split('@')[0],
      email: user.email,
    });

    console.log(`📄 ${user.email} left document ${documentId}`);
  });

  // Handle Yjs document updates
  socket.on(
    'yjs-update',
    ({ documentId, update }: { documentId: string; update: Uint8Array }) => {
      try {
        // Broadcast the update to all other clients in the document room
        socket.to(`document:${documentId}`).emit('yjs-update', {
          update,
          userId: user._id.toString(),
        });

        console.log(
          `🔄 Yjs update from ${user.email} for document ${documentId} (${update.length} bytes)`
        );
      } catch (error) {
        console.error('Error handling Yjs update:', error);
      }
    }
  );

  // Handle Yjs awareness updates (cursor positions, selections, etc.)
  socket.on(
    'yjs-awareness',
    ({ documentId, update }: { documentId: string; update: Uint8Array }) => {
      try {
        // Broadcast awareness update to all other clients in the document room
        socket.to(`document:${documentId}`).emit('yjs-awareness', {
          update,
          userId: user._id.toString(),
        });
      } catch (error) {
        console.error('Error handling Yjs awareness update:', error);
      }
    }
  );

  // Handle disconnect - leave all document rooms
  socket.on('disconnect', () => {
    // Remove from all document presence maps
    documentPresence.forEach((presenceMap, documentId) => {
      if (presenceMap.has(socket.id)) {
        presenceMap.delete(socket.id);

        // Notify others in the room
        socket.to(`document:${documentId}`).emit('user-left', {
          userId: user._id.toString(),
          userName: user.email.split('@')[0],
          email: user.email,
        });

        // Clean up empty maps
        if (presenceMap.size === 0) {
          documentPresence.delete(documentId);
        }
      }
    });

    console.log(`❌ User disconnected: ${user.email} (${socket.id})`);
  });
});

// Error handling
app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO server is ready`);
});
