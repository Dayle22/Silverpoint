// Durable Object Yjs Collaboration Room for @open-pencil/cloud

import * as Y from 'yjs';
import {
  type Env,
  type UserRole,
  BIOSCULPTURE_WORKSPACE_ID,
} from '../types.ts';
import { APIError, createErrorResponse } from '../errors.ts';
import { CloudRepository } from '../db/repository.ts';
import { DropboxClient } from '../dropbox/client.ts';
import { DropboxRepositoryService } from '../dropbox/service.ts';
import type {
  IDurableObjectState,
  ProjectRoomOptions,
  RoomSocketAttachment,
  CollabEnvelope,
  PeerInfo,
} from './types.ts';
import {
  encodeBase64,
  decodeBase64,
  toUint8Array,
  safeParseJSON,
  isStateVectorCurrent,
} from './utils.ts';

const DEFAULT_MAX_MESSAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const DEFAULT_MAX_SNAPSHOT_BYTES = 50 * 1024 * 1024; // 50 MB

export class ProjectRoom {
  private ydoc: Y.Doc;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private projectId = '';
  private readonly peers = new Map<WebSocket, RoomSocketAttachment>();
  private readonly maxMessageBytes: number;
  private readonly maxSnapshotBytes: number;
  private dropboxService?: DropboxRepositoryService;

  constructor(
    public readonly state: IDurableObjectState,
    public readonly env: Env,
    public readonly options?: ProjectRoomOptions
  ) {
    this.ydoc = new Y.Doc();
    this.maxMessageBytes = options?.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
    this.maxSnapshotBytes = options?.maxSnapshotBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES;
    this.dropboxService = options?.dropboxService;
  }

  /**
   * Loads persisted Yjs document state and restores hibernated WebSocket attachments.
   */
  async ensureInitialized(projectId?: string): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (projectId) {
        this.projectId = projectId;
      }

      // 1. Recover canonical Yjs state from Durable Object storage
      const savedDocState = await this.state.storage.get<Uint8Array | number[]>('yjs_state');
      if (savedDocState) {
        const bytes = savedDocState instanceof Uint8Array ? savedDocState : new Uint8Array(savedDocState);
        try {
          Y.applyUpdate(this.ydoc, bytes, 'storage-init');
        } catch {
          // If storage corrupted, start clean to preserve room availability
        }
      }

      // 2. Recover hibernated WebSockets and attachments
      const sockets = this.state.getWebSockets();
      for (const ws of sockets) {
        let attachment: RoomSocketAttachment | null = null;
        if (typeof (ws as unknown as { deserializeAttachment?: () => unknown }).deserializeAttachment === 'function') {
          attachment = (ws as unknown as { deserializeAttachment: () => RoomSocketAttachment }).deserializeAttachment();
        } else if ((ws as unknown as { attachment?: RoomSocketAttachment }).attachment) {
          attachment = (ws as unknown as { attachment: RoomSocketAttachment }).attachment;
        }

        if (attachment) {
          this.peers.set(ws, attachment);
          if (!this.projectId && attachment.projectId) {
            this.projectId = attachment.projectId;
          }
        }
      }

      this.initialized = true;
    })();

    return this.initPromise;
  }

  private getDropboxService(): DropboxRepositoryService {
    if (this.dropboxService) return this.dropboxService;

    const repo = new CloudRepository(this.env.DB);
    if (!this.env.DROPBOX_CLIENT_ID || !this.env.DROPBOX_CLIENT_SECRET || !this.env.DROPBOX_REFRESH_TOKEN) {
      throw APIError.upstreamUnavailable('Dropbox credentials not configured in environment');
    }

    const client = new DropboxClient({
      clientId: this.env.DROPBOX_CLIENT_ID,
      clientSecret: this.env.DROPBOX_CLIENT_SECRET,
      refreshToken: this.env.DROPBOX_REFRESH_TOKEN,
    });

    this.dropboxService = new DropboxRepositoryService(repo, client);
    return this.dropboxService;
  }

  /**
   * Persists compacted canonical Yjs state to DO storage.
   */
  async persistState(): Promise<void> {
    const encodedState = Y.encodeStateAsUpdate(this.ydoc);
    const stateVector = Y.encodeStateVector(this.ydoc);

    await this.state.storage.put('yjs_state', encodedState);
    await this.state.storage.put('state_vector', encodeBase64(stateVector));
    await this.state.storage.put('updated_at', new Date().toISOString());
  }

  /**
   * Handles incoming HTTP / WebSocket upgrade requests to the room.
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Internal inspection endpoint for tests and monitoring
      if (path.endsWith('/inspect') || path.endsWith('/state')) {
        await this.ensureInitialized();
        const stateVector = Y.encodeStateVector(this.ydoc);
        return new Response(
          JSON.stringify({
            projectId: this.projectId,
            connectedPeers: this.peers.size,
            stateVector: encodeBase64(stateVector),
            peers: this.getPeersList(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Authenticated WebSocket upgrade
      const userId = request.headers.get('X-User-Id');
      const email = request.headers.get('X-User-Email');
      const displayName = request.headers.get('X-User-Name') || email || 'Member';
      const role = (request.headers.get('X-User-Role') || 'member') as UserRole;
      const projectId = request.headers.get('X-Project-Id') || this.projectId;

      if (!userId || !email || !projectId) {
        throw APIError.unauthorized('Missing verified user identity headers');
      }

      await this.ensureInitialized(projectId);

      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        throw APIError.invalidRequest('Expected WebSocket upgrade');
      }

      // Create WebSocket pair
      let clientWs: WebSocket;
      let serverWs: WebSocket;

      if (typeof WebSocketPair !== 'undefined') {
        const pair = new WebSocketPair();
        clientWs = pair[0];
        serverWs = pair[1];
      } else {
        // Fallback for custom or test environments
        throw APIError.internal('WebSocketPair is not supported in this runtime');
      }

      const attachment: RoomSocketAttachment = {
        userId,
        email,
        displayName,
        role,
        projectId,
        connectedAt: new Date().toISOString(),
      };

      // Serialise attachment for hibernation recovery
      if (typeof (serverWs as unknown as { serializeAttachment?: (data: unknown) => void }).serializeAttachment === 'function') {
        (serverWs as unknown as { serializeAttachment: (data: unknown) => void }).serializeAttachment(attachment);
      }
      (serverWs as unknown as { attachment?: RoomSocketAttachment }).attachment = attachment;

      // Accept socket into hibernation system
      this.state.acceptWebSocket(serverWs, [userId]);
      this.peers.set(serverWs, attachment);

      // 1. Send welcome message with current peers list
      this.sendEnvelope(serverWs, {
        type: 'welcome',
        senderId: 'room',
        targetId: userId,
        peer: { userId, email, displayName, role },
        peers: this.getPeersList(),
      });

      // 2. Send initial sync-step1 so client can compute and send missing updates
      const canonicalVector = Y.encodeStateVector(this.ydoc);
      this.sendEnvelope(serverWs, {
        type: 'sync-step1',
        senderId: 'room',
        targetId: userId,
        stateVector: encodeBase64(canonicalVector),
        namespace: 'sync-step1',
        data: Array.from(canonicalVector),
      });

      // 3. Broadcast peer-join to all other connected peers
      this.broadcast(
        {
          type: 'peer-join',
          senderId: userId,
          peer: { userId, email, displayName, role },
        },
        serverWs
      );

      return new Response(null, {
        status: 101,
        webSocket: clientWs,
      });
    } catch (err: unknown) {
      return createErrorResponse(err);
    }
  }

  /**
   * WebSocket message handler (hibernation callback).
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer | Uint8Array): Promise<void> {
    await this.ensureInitialized();

    let attachment = this.peers.get(ws);
    if (!attachment) {
      if (typeof (ws as unknown as { deserializeAttachment?: () => unknown }).deserializeAttachment === 'function') {
        attachment = (ws as unknown as { deserializeAttachment: () => RoomSocketAttachment }).deserializeAttachment();
      } else if ((ws as unknown as { attachment?: RoomSocketAttachment }).attachment) {
        attachment = (ws as unknown as { attachment: RoomSocketAttachment }).attachment;
      }

      if (attachment) {
        this.peers.set(ws, attachment);
      } else {
        ws.close(1008, 'Unauthorized: Missing verified socket attachment');
        return;
      }
    }

    const byteLen = typeof message === 'string' ? message.length : message.byteLength;
    if (byteLen > this.maxSnapshotBytes) {
      this.sendEnvelope(ws, {
        type: 'error',
        code: 'payload_too_large',
        error: `Message size ${byteLen} exceeds maximum limit of ${this.maxSnapshotBytes} bytes`,
      });
      return;
    }

    try {
      if (typeof message === 'string') {
        const envelope = safeParseJSON<CollabEnvelope>(message);
        if (!envelope || typeof envelope !== 'object') {
          this.sendEnvelope(ws, { type: 'error', code: 'invalid_json', error: 'Malformed JSON message' });
          return;
        }

        await this.handleEnvelope(ws, attachment, envelope);
      } else {
        // Raw binary message: treat as direct Yjs update
        const bytes = message instanceof Uint8Array ? message : new Uint8Array(message);
        await this.handleYjsUpdate(ws, attachment, bytes);
      }
    } catch (err: unknown) {
      this.sendEnvelope(ws, {
        type: 'error',
        code: 'internal_error',
        error: err instanceof Error ? err.message : 'Failed to process message',
      });
    }
  }

  /**
   * Processes a structured collaboration envelope.
   */
  private async handleEnvelope(
    ws: WebSocket,
    attachment: RoomSocketAttachment,
    envelope: CollabEnvelope
  ): Promise<void> {
    // Multiplex legacy 'action' messages matching src/app/collab/transport
    if (envelope.type === 'action' && envelope.namespace) {
      switch (envelope.namespace) {
        case 'yjs-update': {
          if (!envelope.data) return;
          const bytes = toUint8Array(envelope.data);
          await this.handleYjsUpdate(ws, attachment, bytes);
          return;
        }
        case 'awareness': {
          if (!envelope.data) return;
          const bytes = toUint8Array(envelope.data);
          await this.handleAwareness(ws, attachment, bytes);
          return;
        }
        case 'sync-step1': {
          if (!envelope.data) return;
          const clientVector = toUint8Array(envelope.data);
          await this.handleSyncStep1(ws, attachment, clientVector);
          return;
        }
        case 'sync-reply': {
          if (!envelope.data) return;
          const bytes = toUint8Array(envelope.data);
          await this.handleSyncReply(ws, attachment, bytes);
          return;
        }
        case 'snapshot-candidate': {
          await this.handleSnapshotCandidate(ws, attachment, envelope);
          return;
        }
        default: {
          // Forward arbitrary namespace actions with verified sender identity
          this.broadcast(
            {
              type: 'action',
              namespace: envelope.namespace,
              senderId: attachment.userId,
              targetId: envelope.targetId,
              data: envelope.data,
            },
            ws
          );
          return;
        }
      }
    }

    switch (envelope.type) {
      case 'yjs-update': {
        const raw = envelope.update || envelope.data;
        if (!raw) return;
        const bytes = toUint8Array(raw);
        await this.handleYjsUpdate(ws, attachment, bytes);
        break;
      }

      case 'awareness': {
        const raw = envelope.update || envelope.data;
        if (!raw) return;
        const bytes = toUint8Array(raw);
        await this.handleAwareness(ws, attachment, bytes);
        break;
      }

      case 'sync-step1': {
        const raw = envelope.stateVector || envelope.data;
        if (!raw) return;
        const clientVector = toUint8Array(raw);
        await this.handleSyncStep1(ws, attachment, clientVector);
        break;
      }

      case 'sync-reply': {
        const raw = envelope.update || envelope.data;
        if (!raw) return;
        const bytes = toUint8Array(raw);
        await this.handleSyncReply(ws, attachment, bytes);
        break;
      }

      case 'snapshot-candidate': {
        await this.handleSnapshotCandidate(ws, attachment, envelope);
        break;
      }

      case 'ping': {
        this.sendEnvelope(ws, { type: 'pong', senderId: 'room' });
        break;
      }

      default:
        break;
    }
  }

  private async handleYjsUpdate(
    ws: WebSocket,
    attachment: RoomSocketAttachment,
    updateBytes: Uint8Array
  ): Promise<void> {
    if (updateBytes.length === 0) return;

    try {
      Y.applyUpdate(this.ydoc, updateBytes, 'remote-peer');
    } catch {
      this.sendEnvelope(ws, {
        type: 'error',
        code: 'invalid_update',
        error: 'Malformed Yjs binary update payload',
      });
      return;
    }

    // Persist canonical state in Durable Object storage
    await this.persistState();

    // Broadcast to all other peers in the room
    this.broadcast(
      {
        type: 'yjs-update',
        senderId: attachment.userId,
        namespace: 'yjs-update',
        data: Array.from(updateBytes),
        update: encodeBase64(updateBytes),
      },
      ws
    );
  }

  private async handleAwareness(
    ws: WebSocket,
    attachment: RoomSocketAttachment,
    awarenessBytes: Uint8Array
  ): Promise<void> {
    // Ephemeral awareness: enforce verified socket identity over any client-forged identity
    this.broadcast(
      {
        type: 'awareness',
        senderId: attachment.userId,
        namespace: 'awareness',
        data: Array.from(awarenessBytes),
        update: encodeBase64(awarenessBytes),
        peer: {
          userId: attachment.userId,
          email: attachment.email,
          displayName: attachment.displayName,
          role: attachment.role,
        },
      },
      ws
    );
  }

  private async handleSyncStep1(
    ws: WebSocket,
    attachment: RoomSocketAttachment,
    clientVector: Uint8Array
  ): Promise<void> {
    // Encode state as update against client state vector
    const diff = Y.encodeStateAsUpdate(this.ydoc, clientVector);

    this.sendEnvelope(ws, {
      type: 'sync-reply',
      senderId: 'room',
      targetId: attachment.userId,
      namespace: 'sync-reply',
      data: Array.from(diff),
      update: encodeBase64(diff),
    });
  }

  private async handleSyncReply(
    ws: WebSocket,
    attachment: RoomSocketAttachment,
    updateBytes: Uint8Array
  ): Promise<void> {
    if (updateBytes.length === 0) return;

    try {
      Y.applyUpdate(this.ydoc, updateBytes, 'sync-reply');
    } catch {
      this.sendEnvelope(ws, {
        type: 'error',
        code: 'invalid_update',
        error: 'Malformed Yjs sync reply update payload',
      });
      return;
    }

    await this.persistState();

    // Broadcast update to others
    this.broadcast(
      {
        type: 'yjs-update',
        senderId: attachment.userId,
        namespace: 'yjs-update',
        data: Array.from(updateBytes),
        update: encodeBase64(updateBytes),
      },
      ws
    );
  }

  /**
   * Validates snapshot candidate against canonical room state vector and calls Dropbox repository.
   */
  private async handleSnapshotCandidate(
    ws: WebSocket,
    attachment: RoomSocketAttachment,
    envelope: CollabEnvelope
  ): Promise<void> {
    const rawSnapshot = envelope.snapshot || envelope.data;
    const rawStateVector = envelope.stateVector;
    const expectedRev = envelope.expectedRev;

    if (!rawSnapshot) {
      this.sendEnvelope(ws, {
        type: 'snapshot-response',
        success: false,
        code: 'invalid_request',
        error: 'Snapshot payload is required',
      });
      return;
    }

    if (!expectedRev) {
      this.sendEnvelope(ws, {
        type: 'snapshot-response',
        success: false,
        code: 'invalid_request',
        error: 'expectedRev is required for guarded snapshot save',
      });
      return;
    }

    if (!rawStateVector) {
      this.sendEnvelope(ws, {
        type: 'snapshot-response',
        success: false,
        code: 'invalid_request',
        error: 'stateVector is required to verify snapshot candidate freshness',
      });
      return;
    }

    const candidateVector = toUint8Array(rawStateVector);
    const isCurrent = isStateVectorCurrent(this.ydoc, candidateVector);

    if (!isCurrent) {
      // Reject stale snapshot candidate with conflict error and trigger client resync
      const canonicalVector = Y.encodeStateVector(this.ydoc);
      this.sendEnvelope(ws, {
        type: 'snapshot-response',
        success: false,
        code: 'conflict',
        error: 'State vector mismatch: document has newer concurrent updates in the room. Client must resynchronize before saving.',
      });

      // Send sync-step1 to get client back in sync
      this.sendEnvelope(ws, {
        type: 'sync-step1',
        senderId: 'room',
        targetId: attachment.userId,
        stateVector: encodeBase64(canonicalVector),
        namespace: 'sync-step1',
        data: Array.from(canonicalVector),
      });
      return;
    }

    const snapshotBytes = toUint8Array(rawSnapshot);
    if (snapshotBytes.byteLength > this.maxSnapshotBytes) {
      this.sendEnvelope(ws, {
        type: 'snapshot-response',
        success: false,
        code: 'payload_too_large',
        error: `Snapshot size ${snapshotBytes.byteLength} exceeds maximum allowed size`,
      });
      return;
    }

    // Call Dropbox repository with optimistic concurrency rev checking
    try {
      const service = this.getDropboxService();
      const canonicalVector = Y.encodeStateVector(this.ydoc);
      const canonicalVectorBase64 = encodeBase64(canonicalVector);

      const result = await service.updateSnapshot(this.projectId, {
        bytes: snapshotBytes,
        expectedRev,
        stateVector: canonicalVectorBase64,
        actorId: attachment.userId,
        retainVersion: envelope.retainVersion,
      });

      await this.state.storage.put('dropbox_rev', result.rev);

      this.sendEnvelope(ws, {
        type: 'snapshot-response',
        success: true,
        rev: result.rev,
        stateVector: result.stateVector,
      });

      // Broadcast new revision to other peers
      this.broadcast(
        {
          type: 'action',
          namespace: 'snapshot-saved',
          senderId: attachment.userId,
          rev: result.rev,
          stateVector: result.stateVector,
        },
        ws
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Snapshot save failed';
      this.sendEnvelope(ws, {
        type: 'snapshot-response',
        success: false,
        code: 'conflict',
        error: message,
      });
    }
  }

  /**
   * WebSocket close handler (hibernation callback).
   */
  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const attachment = this.peers.get(ws);
    this.peers.delete(ws);

    if (attachment) {
      this.broadcast({
        type: 'peer-leave',
        senderId: attachment.userId,
        targetId: attachment.userId,
        peer: {
          userId: attachment.userId,
          email: attachment.email,
          displayName: attachment.displayName,
          role: attachment.role,
        },
      });
    }
  }

  /**
   * WebSocket error handler.
   */
  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.peers.delete(ws);
  }

  private sendEnvelope(ws: WebSocket, envelope: CollabEnvelope): void {
    try {
      ws.send(JSON.stringify(envelope));
    } catch {
      // Socket may have closed concurrently
    }
  }

  private broadcast(envelope: CollabEnvelope, excludeWs?: WebSocket): void {
    const payload = JSON.stringify(envelope);
    for (const [ws] of this.peers.entries()) {
      if (ws === excludeWs) continue;
      try {
        ws.send(payload);
      } catch {
        // Socket closed or broken
      }
    }
  }

  private getPeersList(): PeerInfo[] {
    const peers: PeerInfo[] = [];
    const seen = new Set<string>();

    for (const attachment of this.peers.values()) {
      if (!seen.has(attachment.userId)) {
        seen.add(attachment.userId);
        peers.push({
          userId: attachment.userId,
          email: attachment.email,
          displayName: attachment.displayName,
          role: attachment.role,
        });
      }
    }

    return peers;
  }

  /**
   * Returns current canonical Y.Doc instance (for testing and direct inspection).
   */
  getYDoc(): Y.Doc {
    return this.ydoc;
  }

  /**
   * Returns active peers map (for testing).
   */
  getPeers(): Map<WebSocket, RoomSocketAttachment> {
    return this.peers;
  }
}
