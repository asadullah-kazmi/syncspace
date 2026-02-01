'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { SocketIOProvider } from '../lib/SocketIOProvider';
import { getUserColor, getUsernameFromEmail } from '../lib/userUtils';

interface UseCollaborationOptions {
  documentId: string;
  yjsDoc: Y.Doc;
  user: {
    id: string;
    email: string;
  } | null;
  permission: 'owner' | 'editor' | 'viewer';
  token?: string;
  serverUrl?: string;
}

/**
 * Hook to manage Socket.IO connection and Yjs provider for collaborative editing
 */
export function useCollaboration({
  documentId,
  yjsDoc,
  user,
  permission,
  token,
  serverUrl = 'http://localhost:5000',
}: UseCollaborationOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [provider, setProvider] = useState<SocketIOProvider | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [userCount, setUserCount] = useState(1);
  const [color, setColor] = useState('#808080');
  const providerRef = useRef<SocketIOProvider | null>(null);

  useEffect(() => {
    if (!documentId || !token || !user) {
      setStatus('disconnected');
      return;
    }

    // Set user color
    const userColor = getUserColor(user.id);
    setColor(userColor);

    // Create Socket.IO connection with JWT auth
    const socketInstance = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    // Create Yjs provider
    const providerInstance = new SocketIOProvider(socketInstance, yjsDoc, documentId);
    providerRef.current = providerInstance;

    // Listen for status changes
    providerInstance.onStatus((statusUpdate) => {
      setStatus(statusUpdate.status);
      if (statusUpdate.error) {
        setError(statusUpdate.error);
      }
    });

    // Handle connection
    socketInstance.on('connect', async () => {
      setStatus('connected');
      setError(null);

      // Join document room
      const result = await providerInstance.connect();
      if (result.success && result.users) {
        setUserCount(result.users.length);
      } else if (result.error) {
        setError(result.error);
        setStatus('error');
      }
    });

    // Handle user presence
    socketInstance.on('user-joined', () => {
      setUserCount((prev) => prev + 1);
    });

    socketInstance.on('user-left', () => {
      setUserCount((prev) => Math.max(1, prev - 1));
    });

    socketInstance.on('connect_error', (err) => {
      setError(err.message);
      setStatus('error');
    });

    socketInstance.on('disconnect', () => {
      setStatus('disconnected');
    });

    setSocket(socketInstance);
    setProvider(providerInstance);

    // Cleanup on unmount
    return () => {
      providerInstance.disconnect();
      socketInstance.disconnect();
      providerRef.current = null;
    };
  }, [documentId, token, serverUrl, yjsDoc, user]);

  return {
    socket,
    provider,
    status,
    error,
    userCount,
    color,
    awareness: provider?.awareness,
    isConnected: status === 'connected',
  };
}
