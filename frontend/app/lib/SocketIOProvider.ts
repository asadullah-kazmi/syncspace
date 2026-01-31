'use client';

import * as Y from 'yjs';
import { Socket } from 'socket.io-client';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';

/**
 * Socket.IO provider for Yjs
 * Syncs Yjs document updates through Socket.IO with JWT authentication
 */
export class SocketIOProvider {
  public awareness: Awareness;
  private socket: Socket;
  private doc: Y.Doc;
  private documentId: string;
  private synced: boolean = false;
  private isReconnecting: boolean = false;
  private userRole: 'owner' | 'editor' | 'viewer' | null = null;
  private onSyncedCallbacks: ((synced: boolean) => void)[] = [];
  private onStatusCallbacks: ((status: { status: 'connected' | 'disconnected' | 'error'; error?: string }) => void)[] = [];

  constructor(socket: Socket, doc: Y.Doc, documentId: string) {
    this.socket = socket;
    this.doc = doc;
    this.documentId = documentId;
    this.awareness = new Awareness(doc);

    this.setupListeners();
  }

  private setupListeners() {
    // Listen for local document updates and send to server
    this.doc.on('update', this.handleLocalUpdate);

    // Listen for awareness updates and send to server
    this.awareness.on('update', this.handleAwarenessUpdate);

    // Listen for incoming Yjs updates from server
    this.socket.on('yjs-update', this.handleRemoteUpdate);

    // Listen for initial sync (full document state from server)
    this.socket.on('yjs-sync', this.handleInitialSync);

    // Listen for incoming awareness updates from server
    this.socket.on('yjs-awareness', this.handleRemoteAwareness);

    // Handle user joined/left events
    this.socket.on('user-joined', this.handleUserJoined);
    this.socket.on('user-left', this.handleUserLeft);

    // Handle permission denied
    this.socket.on('permission-denied', this.handlePermissionDenied);

    // Handle connection status
    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on('connect_error', this.handleConnectionError);
  }

  private handleLocalUpdate = (update: Uint8Array, origin: any) => {
    // Don't send updates that came from remote (to avoid loops)
    if (origin !== this) {
      this.socket.emit('yjs-update', {
        documentId: this.documentId,
        update: Array.from(update), // Convert Uint8Array to regular array for JSON
      });
    }
  };

  private handleAwarenessUpdate = ({ added, updated, removed }: any) => {
    const changedClients = added.concat(updated).concat(removed);
    const awarenessUpdate = encodeAwarenessUpdate(this.awareness, changedClients);
    
    this.socket.emit('yjs-awareness', {
      documentId: this.documentId,
      update: Array.from(awarenessUpdate),
    });
  };

  private handleRemoteUpdate = ({ update, userId }: { update: number[]; userId: string }) => {
    try {
      // Convert array back to Uint8Array
      const updateArray = new Uint8Array(update);
      
      // Apply the update to local document
      // Pass 'this' as origin to prevent sending this update back to server
      Y.applyUpdate(this.doc, updateArray, this);
      
      console.log(`📥 Applied Yjs update from user ${userId} (${update.length} bytes)`);
    } catch (error) {
      console.error('Error applying remote Yjs update:', error);
    }
  };

  private handleInitialSync = ({ update }: { update: number[] }) => {
    try {
      // Convert array back to Uint8Array
      const updateArray = new Uint8Array(update);
      
      // Apply the full document state to local document
      // Pass 'this' as origin to prevent sending this update back to server
      Y.applyUpdate(this.doc, updateArray, this);
      
      console.log(`📦 Applied initial document state (${update.length} bytes)`);
      
      // Mark as synced after receiving initial state
      this.synced = true;
      this.notifySynced(true);
    } catch (error) {
      console.error('Error applying initial document sync:', error);
    }
  };

  private handleRemoteAwareness = ({ update, userId }: { update: number[]; userId: string }) => {
    try {
      const updateArray = new Uint8Array(update);
      applyAwarenessUpdate(this.awareness, updateArray, this);
    } catch (error) {
      console.error('Error applying remote awareness update:', error);
    }
  };

  private handleUserJoined = (user: { userId: string; userName: string; email: string }) => {
    console.log(`👤 User joined: ${user.userName} (${user.email})`);
  };

  private handleUserLeft = (user: { userId: string; userName: string; email: string }) => {
    console.log(`👤 User left: ${user.userName} (${user.email})`);
  };

  private handlePermissionDenied = ({ message }: { documentId: string; message: string }) => {
    console.error(`🚫 Permission denied: ${message}`);
    this.notifyStatus({ status: 'error', error: message });
  };

  private handleConnect = async () => {
    console.log('🔌 Connected to Socket.IO server');
    this.notifyStatus({ status: 'connected' });

    // If this is a reconnection, rejoin the document
    if (this.isReconnecting) {
      console.log('🔄 Reconnecting to document...');
      await this.reconnect();
      this.isReconnecting = false;
    }
  };

  private handleDisconnect = () => {
    console.log('🔌 Disconnected from Socket.IO server');
    this.synced = false;
    this.isReconnecting = true;
    this.notifySynced(false);
    this.notifyStatus({ status: 'disconnected' });
  };

  private handleConnectionError = (error: Error) => {
    console.error('❌ Connection error:', error.message);
    this.notifyStatus({ status: 'error', error: error.message });
  };

  /**
   * Join the document room on the server
   */
  public async connect(): Promise<{ success: boolean; users?: any[]; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('join-document', this.documentId, (response: any) => {
        if (response.success) {
          this.synced = true;
          this.notifySynced(true);
          console.log(`✅ Joined document ${this.documentId}`, response.users);
        } else {
          console.error(`❌ Failed to join document: ${response.error}`);
        }
        resolve(response);
      });
    });
  }

  /**
   * Reconnect to document after network interruption
   */
  private async reconnect(): Promise<void> {
    try {
      // Get local state vector to request missing updates
      const stateVector = Y.encodeStateVector(this.doc);
      
      // Rejoin the document room with state vector
      return new Promise((resolve, reject) => {
        this.socket.emit('rejoin-document', {
          documentId: this.documentId,
          stateVector: Array.from(stateVector),
        }, (response: any) => {
          if (response.success) {
            console.log(`✅ Reconnected to document ${this.documentId}`);
            // Server will send yjs-sync with missing updates
            resolve();
          } else {
            console.error(`❌ Failed to reconnect: ${response.error}`);
            reject(new Error(response.error));
          }
        });
      });
    } catch (error) {
      console.error('Error during reconnection:', error);
      // Fallback: do a full rejoin
      await this.connect();
    }
  }

  /**
   * Leave the document room
   */
  public disconnect() {
    this.socket.emit('leave-document', this.documentId);
    
    // Remove listeners
    this.doc.off('update', this.handleLocalUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    
    this.socket.off('yjs-update', this.handleRemoteUpdate);
    this.socket.off('yjs-sync', this.handleInitialSync);
    this.socket.off('yjs-awareness', this.handleRemoteAwareness);
    this.socket.off('user-joined', this.handleUserJoined);
    this.socket.off('user-left', this.handleUserLeft);
    this.socket.off('permission-denied', this.handlePermissionDenied);
    this.socket.off('connect', this.handleConnect);
    this.socket.off('disconnect', this.handleDisconnect);
    this.socket.off('connect_error', this.handleConnectionError);

    this.awareness.destroy();
    this.synced = false;
    this.notifySynced(false);
  }

  /**
   * Check if the provider is synced
   */
  public get isSynced(): boolean {
    return this.synced;
  }

  /**
   * Register callback for sync state changes
   */
  public onSynced(callback: (synced: boolean) => void) {
    this.onSyncedCallbacks.push(callback);
  }

  /**
   * Register callback for status changes
   */
  public onStatus(callback: (status: { status: 'connected' | 'disconnected' | 'error'; error?: string }) => void) {
    this.onStatusCallbacks.push(callback);
  }

  private notifySynced(synced: boolean) {
    this.onSyncedCallbacks.forEach(cb => cb(synced));
  }

  private notifyStatus(status: { status: 'connected' | 'disconnected' | 'error'; error?: string }) {
    this.onStatusCallbacks.forEach(cb => cb(status));
  }
}
