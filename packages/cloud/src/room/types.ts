// Durable Object room types and protocol contracts for @open-pencil/cloud

import type { UserRole } from '../types.ts';
import type { DropboxRepositoryService } from '../dropbox/service.ts';

export interface RoomSocketAttachment {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  projectId: string;
  connectedAt: string;
}

export interface PeerInfo {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export type CollabMessageType =
  | 'yjs-update'
  | 'awareness'
  | 'sync-step1'
  | 'sync-reply'
  | 'snapshot-candidate'
  | 'snapshot-response'
  | 'peer-join'
  | 'peer-leave'
  | 'peers-list'
  | 'welcome'
  | 'action'
  | 'ping'
  | 'pong'
  | 'error';

export interface CollabEnvelope {
  type: CollabMessageType;
  senderId?: string;
  targetId?: string;
  namespace?: string;
  data?: string | number[] | Uint8Array;
  stateVector?: string;
  snapshot?: string;
  expectedRev?: string;
  retainVersion?: boolean;
  rev?: string;
  peer?: PeerInfo;
  peers?: PeerInfo[];
  error?: string;
  code?: string;
  success?: boolean;
}

export interface IDurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
  deleteAll(): Promise<void>;
}

export interface IDurableObjectState {
  storage: IDurableObjectStorage;
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  setWebSocketAutoResponse?(param: unknown): void;
  waitUntil?(promise: Promise<unknown>): void;
}

export interface ProjectRoomOptions {
  dropboxService?: DropboxRepositoryService;
  maxMessageBytes?: number;
  maxSnapshotBytes?: number;
}
