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
import DocumentModel, { ICollaborator } from './models/document.model';
import mongoose from 'mongoose';
import * as Y from 'yjs';

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

// Track Y.Doc instances and update counts for persistence
const documentStates = new Map<
  string,
  {
    ydoc: Y.Doc;
    updateCount: number;
    timer: NodeJS.Timeout | null;
    lastAccess: number;
  }
>();
const SAVE_INTERVAL = 30000; // 30 seconds
const UPDATES_THRESHOLD = 50; // Save after 50 updates
const CLEANUP_INACTIVE_TIMEOUT = 300000; // 5 minutes of inactivity
const CLEANUP_CHECK_INTERVAL = 60000; // Check for cleanup every minute

/**
 * Cleanup inactive documents to free memory
 */
function cleanupInactiveDocuments() {
  const now = Date.now();
  const inactiveDocuments: string[] = [];

  documentStates.forEach((state, documentId) => {
    // Skip if document has active users
    if (
      documentPresence.has(documentId) &&
      documentPresence.get(documentId)!.size > 0
    ) {
      state.lastAccess = now; // Update access time
      return;
    }

    // Check if document has been inactive
    if (now - state.lastAccess > CLEANUP_INACTIVE_TIMEOUT) {
      inactiveDocuments.push(documentId);
    }
  });

  // Cleanup inactive documents
  inactiveDocuments.forEach((documentId) => {
    console.log(`🧹 Cleaning up inactive document ${documentId}`);
    cleanupDocumentState(documentId);
  });
}

// Start periodic cleanup
setInterval(cleanupInactiveDocuments, CLEANUP_CHECK_INTERVAL);

/**
 * Save Yjs document snapshot to MongoDB
 */
async function saveDocumentSnapshot(documentId: string) {
  const state = documentStates.get(documentId);
  if (!state) return;

  try {
    // Use compact encoding for smaller snapshots
    const snapshot = Y.encodeStateAsUpdate(state.ydoc);

    await DocumentModel.findByIdAndUpdate(documentId, {
      yjsSnapshot: Buffer.from(snapshot),
    });

    console.log(
      `💾 Saved snapshot for document ${documentId} (${snapshot.length} bytes)`
    );

    // Reset update count and update access time
    state.updateCount = 0;
    state.lastAccess = Date.now();
  } catch (error) {
    console.error(`Error saving snapshot for document ${documentId}:`, error);
  }
}

/**
 * Get or create Y.Doc instance for a document
 */
function getYDoc(documentId: string): Y.Doc {
  let state = documentStates.get(documentId);

  if (!state) {
    const ydoc = new Y.Doc();

    // Set up periodic save timer
    const timer = setInterval(() => {
      saveDocumentSnapshot(documentId);
    }, SAVE_INTERVAL);

    state = { ydoc, updateCount: 0, timer, lastAccess: Date.now() };
    documentStates.set(documentId, state);

    console.log(`📝 Created new Y.Doc for document ${documentId}`);
  }

  // Update last access time
  state.lastAccess = Date.now();

  return state.ydoc;
}

/**
 * Load existing snapshot from MongoDB into Y.Doc
 */
async function loadDocumentSnapshot(documentId: string): Promise<Y.Doc> {
  const ydoc = getYDoc(documentId);

  try {
    const document = await DocumentModel.findById(documentId);

    if (document?.yjsSnapshot && document.yjsSnapshot.length > 0) {
      const update = new Uint8Array(document.yjsSnapshot);
      Y.applyUpdate(ydoc, update);
      console.log(
        `📂 Loaded snapshot for document ${documentId} (${update.length} bytes)`
      );
    }
  } catch (error) {
    console.error(`Error loading snapshot for document ${documentId}:`, error);
  }

  return ydoc;
}

/**
 * Cleanup document state when no users are connected
 */
function cleanupDocumentState(documentId: string) {
  const state = documentStates.get(documentId);
  if (!state) return;

  // Save final snapshot before cleanup
  saveDocumentSnapshot(documentId);

  // Clear timer
  if (state.timer) {
    clearInterval(state.timer);
  }

  // Destroy Y.Doc
  state.ydoc.destroy();
  documentStates.delete(documentId);

  console.log(`🧹 Cleaned up Y.Doc for document ${documentId}`);
}

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

      // Load document snapshot if not already loaded
      const ydoc = await loadDocumentSnapshot(documentId);

      // Get current document state and send to newly connected client
      const stateVector = Y.encodeStateAsUpdate(ydoc);

      // Send the full document state to the client
      socket.emit('yjs-sync', {
        update: Array.from(stateVector),
      });

      console.log(
        `📤 Sent document state to ${user.email} (${stateVector.length} bytes)`
      );

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

  // Handle document rejoin after reconnection
  socket.on(
    'rejoin-document',
    async (
      {
        documentId,
        stateVector,
      }: { documentId: string; stateVector: number[] },
      callback
    ) => {
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

        // Rejoin the room
        socket.join(`document:${documentId}`);

        // Get the server's Y.Doc
        const ydoc = await loadDocumentSnapshot(documentId);

        // Calculate the diff between client's state and server's state
        const clientStateVector = new Uint8Array(stateVector);
        const diff = Y.encodeStateAsUpdate(ydoc, clientStateVector);

        // Send only the missing updates to the client
        socket.emit('yjs-sync', {
          update: Array.from(diff),
        });

        console.log(
          `🔄 Sent missing updates to ${user.email} for document ${documentId} (${diff.length} bytes)`
        );

        // Update presence tracking
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

        console.log(`📄 ${user.email} rejoined document ${documentId}`);

        callback?.({ success: true, users: usersInRoom });
      } catch (error) {
        console.error('Error rejoining document:', error);
        callback?.({ success: false, error: 'Failed to rejoin document' });
      }
    }
  );

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
    async ({
      documentId,
      update,
    }: {
      documentId: string;
      update: Uint8Array;
    }) => {
      try {
        // Check user permissions before allowing updates
        const document = await DocumentModel.findById(documentId);

        if (!document) {
          console.warn(
            `⚠️ Document ${documentId} not found for update from ${user.email}`
          );
          return;
        }

        // Check if user is owner
        const isOwner = document.ownerId.toString() === user._id.toString();

        // Check if user is editor
        const collaborator = document.collaborators.find(
          (c: ICollaborator) => c.userId.toString() === user._id.toString()
        );
        const isEditor = collaborator?.role === 'editor';
        const isViewer = collaborator?.role === 'viewer';

        // Reject updates from viewers
        if (isViewer && !isOwner && !isEditor) {
          console.warn(
            `🚫 Viewer ${user.email} attempted to edit document ${documentId}`
          );
          socket.emit('permission-denied', {
            documentId,
            message: 'Viewers cannot edit this document',
          });
          return;
        }

        // Allow updates from owners and editors
        if (!isOwner && !isEditor) {
          console.warn(
            `🚫 User ${user.email} has no edit permission for document ${documentId}`
          );
          socket.emit('permission-denied', {
            documentId,
            message: 'You do not have permission to edit this document',
          });
          return;
        }

        // Get Y.Doc instance
        const ydoc = getYDoc(documentId);

        // Apply update to server's Y.Doc
        const updateArray = Array.isArray(update)
          ? new Uint8Array(update)
          : update;
        Y.applyUpdate(ydoc, updateArray);

        // Broadcast the update to all other clients in the document room
        socket.to(`document:${documentId}`).emit('yjs-update', {
          update,
          userId: user._id.toString(),
        });

        // Track update count and save if threshold reached
        const state = documentStates.get(documentId);
        if (state) {
          state.updateCount++;

          if (state.updateCount >= UPDATES_THRESHOLD) {
            await saveDocumentSnapshot(documentId);
          }
        }

        console.log(
          `🔄 Yjs update from ${user.email} for document ${documentId} (${updateArray.length} bytes)`
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

          // Cleanup Y.Doc state when no users are connected
          cleanupDocumentState(documentId);
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
