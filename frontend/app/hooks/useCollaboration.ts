'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { SocketIOProvider } from '../lib/SocketIOProvider';

interface UseCollaborationOptions {
  documentId: string;
  token: string;
  serverUrl?: string;
}

/**
 * Hook to manage Socket.IO connection and Yjs provider for collaborative editing
 */
export function useCollaboration(yjsDoc: Y.Doc, { documentId, token, serverUrl = 'http://localhost:5000' }: UseCollaborationOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [provider, setProvider] = useState<SocketIOProvider | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const providerRef = useRef<SocketIOProvider | null>(null);

  useEffect(() => {
    if (!documentId || !token) return;

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
        setUsers(result.users);
      } else if (result.error) {
        setError(result.error);
        setStatus('error');
      }
    });

    // Handle user presence
    socketInstance.on('user-joined', (user: any) => {
      setUsers((prev) => [...prev, user]);
    });

    socketInstance.on('user-left', (user: any) => {
      setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
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
  }, [documentId, token, serverUrl, yjsDoc]);

  return {
    socket,
    provider,
    status,
    error,
    users,
    isConnected: status === 'connected',
  };
}
