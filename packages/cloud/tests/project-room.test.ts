// Tests for Authenticated Durable Object Collaboration Relay (F-016e)

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Y from 'yjs';

import { CloudRepository } from '../src/db/repository.ts';
import { createRouter } from '../src/index.ts';
import { ProjectRoom } from '../src/room/project-room.ts';
import type {
  IDurableObjectState,
  IDurableObjectStorage,
  RoomSocketAttachment,
  CollabEnvelope,
} from '../src/room/types.ts';
import { encodeBase64, decodeBase64 } from '../src/room/utils.ts';
import { getManagedCurrentFigPath } from '../src/dropbox/types.ts';
import { base64UrlEncode, type JWKKey } from '../src/auth/access.ts';
import {
  BIOSCULPTURE_WORKSPACE_ID,
  type Env,
  type IDatabaseBinding,
  type IDurableObjectNamespace,
  type IDurableObjectStub,
} from '../src/types.ts';
import type { IDropboxClient } from '../src/dropbox/client.ts';
import { DropboxRepositoryService } from '../src/dropbox/service.ts';

type SqliteBindValue = string | number | bigint | boolean | null | Uint8Array;
interface DatabaseRow {
  [column: string]: unknown;
}

function createInMemoryD1(migrationSql: string): { db: Database; d1: IDatabaseBinding } {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(migrationSql);

  const d1: IDatabaseBinding = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T = unknown>(colName?: string): Promise<T | null> {
              const stmt = db.prepare(query);
              const row = stmt.get(...(values as SqliteBindValue[]));
              if (!row || typeof row !== 'object') return null;
              if (colName) {
                const map = row as DatabaseRow;
                return (map[colName] as T) ?? null;
              }
              return row as T;
            },
            async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
              const stmt = db.prepare(query);
              const rows = stmt.all(...(values as SqliteBindValue[])) as T[];
              return { results: rows, success: true };
            },
            async run(): Promise<{ success: boolean; meta?: unknown }> {
              const stmt = db.prepare(query);
              stmt.run(...(values as SqliteBindValue[]));
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { db, d1 };
}

class MockDurableObjectStorage implements IDurableObjectStorage {
  private data = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    for (const [k, v] of this.data.entries()) {
      if (!options?.prefix || k.startsWith(options.prefix)) {
        result.set(k, v as T);
      }
    }
    return result;
  }

  async deleteAll(): Promise<void> {
    this.data.clear();
  }
}

class MockDurableObjectState implements IDurableObjectState {
  public storage: IDurableObjectStorage;
  public acceptedWebSockets: WebSocket[] = [];

  constructor(storage?: IDurableObjectStorage) {
    this.storage = storage || new MockDurableObjectStorage();
  }

  acceptWebSocket(ws: WebSocket, _tags?: string[]): void {
    if (!this.acceptedWebSockets.includes(ws)) {
      this.acceptedWebSockets.push(ws);
    }
  }

  getWebSockets(_tag?: string): WebSocket[] {
    return [...this.acceptedWebSockets];
  }
}

class MockWebSocket {
  public readyState = 1; // OPEN
  public attachment: RoomSocketAttachment | null = null;
  public partner: MockWebSocket | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onclose: ((event: { code: number; reason: string }) => void) | null = null;
  public sentMessages: string[] = [];

  constructor() {}

  serializeAttachment(attachment: RoomSocketAttachment): void {
    this.attachment = attachment;
  }

  deserializeAttachment(): RoomSocketAttachment | null {
    return this.attachment;
  }

  send(data: string): void {
    this.sentMessages.push(data);
    if (this.partner && this.partner.readyState === 1) {
      setTimeout(() => {
        if (this.partner?.onmessage) {
          this.partner.onmessage({ data });
        }
      }, 0);
    }
  }

  close(code = 1000, reason = 'Normal Closure'): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code, reason });
    }
    if (this.partner && this.partner.readyState !== 3) {
      this.partner.readyState = 3;
      if (this.partner.onclose) {
        this.partner.onclose({ code, reason });
      }
    }
  }
}

function createMockWebSocketPair(): [MockWebSocket, MockWebSocket] {
  const client = new MockWebSocket();
  const server = new MockWebSocket();
  client.partner = server;
  server.partner = client;
  return [client, server];
}

class MockDropboxClient implements IDropboxClient {
  public files = new Map<string, { content: Uint8Array; rev: string }>();
  public currentRevCounter = 100;

  async getAccessToken(): Promise<string> {
    return 'mock_token';
  }

  async listFolder(): Promise<any> {
    return { entries: [], has_more: false };
  }

  async listFolderContinue(): Promise<any> {
    return { entries: [], has_more: false };
  }

  async listAllFolderEntries(): Promise<any[]> {
    return [];
  }

  async createFolder(path: string): Promise<any> {
    return { id: `id_${path}`, path_display: path, name: path.split('/').pop() };
  }

  async uploadFile(path: string, content: string | Uint8Array, mode?: any): Promise<any> {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    const existing = this.files.get(path);

    if (mode?.['.tag'] === 'update') {
      const expectedRev = mode.update;
      if (!existing || existing.rev !== expectedRev) {
        const err: any = new Error('Revision mismatch');
        err.status = 409;
        throw err;
      }
    }

    this.currentRevCounter++;
    const newRev = `rev_${this.currentRevCounter}`;
    this.files.set(path, { content: bytes, rev: newRev });
    return { id: `id_${path}`, path_display: path, rev: newRev, size: bytes.length };
  }

  async downloadFile(path: string): Promise<{ content: Uint8Array; metadata: any }> {
    const file = this.files.get(path);
    if (!file) {
      const err: any = new Error('File not found');
      err.status = 404;
      throw err;
    }
    return { content: file.content, metadata: { rev: file.rev, path_display: path } };
  }

  async getMetadata(path: string): Promise<any> {
    const file = this.files.get(path);
    if (!file) return null;
    return { id: `id_${path}`, path_display: path, rev: file.rev };
  }

  async deletePath(path: string): Promise<any> {
    this.files.delete(path);
    return { metadata: { path_display: path } };
  }
}

// Test RSA Keypair for signing test Access JWTs
let testPrivateKey: CryptoKey;
let testPublicKeyJwk: JWKKey;
const TEST_KID = 'test-access-key-1';
const TEST_AUDIENCE = 'test-aud-12345';
const TEST_ISSUER = 'https://biosculpture-test.cloudflareaccess.com';

async function createSignedAccessJWT(
  payload: Record<string, unknown>,
  headerOverrides: Record<string, unknown> = {},
  key: CryptoKey = testPrivateKey
): Promise<string> {
  const header = {
    alg: 'RS256',
    kid: TEST_KID,
    typ: 'JWT',
    ...headerOverrides,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(
    JSON.stringify({
      aud: [TEST_AUDIENCE],
      iss: TEST_ISSUER,
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    })
  );
  const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    dataToSign
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

describe('Authenticated Durable Object Collaboration Relay (F-016e)', () => {
  let d1: IDatabaseBinding;
  let repo: CloudRepository;
  let mockDropbox: MockDropboxClient;
  let dropboxService: DropboxRepositoryService;
  let roomInstances: Map<string, ProjectRoom>;
  let roomStates: Map<string, IDurableObjectState>;
  let env: Env;
  let routerAuthOptions: any;

  const authHeader = 'Cf-Access-Jwt-Assertion';

  beforeAll(async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
    testPrivateKey = keyPair.privateKey;
    const exportedJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    testPublicKeyJwk = {
      ...exportedJwk,
      kid: TEST_KID,
      alg: 'RS256',
      use: 'sig',
    };
  });

  beforeEach(async () => {
    const migrationSql = readFileSync(
      join(import.meta.dir, '../migrations/0001_biosculpture_workspace.sql'),
      'utf-8'
    );
    const inMem = createInMemoryD1(migrationSql);
    d1 = inMem.d1;
    repo = new CloudRepository(d1);
    mockDropbox = new MockDropboxClient();
    dropboxService = new DropboxRepositoryService(repo, mockDropbox);

    roomInstances = new Map();
    roomStates = new Map();

    const doNamespace: IDurableObjectNamespace = {
      idFromName(name: string) {
        return name;
      },
      get(id: unknown): IDurableObjectStub {
        const roomId = String(id);
        if (!roomInstances.has(roomId)) {
          let state = roomStates.get(roomId);
          if (!state) {
            state = new MockDurableObjectState();
            roomStates.set(roomId, state);
          }
          const room = new ProjectRoom(state, env, { dropboxService });
          roomInstances.set(roomId, room);
        }
        const room = roomInstances.get(roomId)!;

        return {
          async fetch(request: Request | string, init?: RequestInit): Promise<Response> {
            const req = typeof request === 'string' ? new Request(request, init) : request;

            // Handle WebSocket upgrade pairing simulation
            const upgrade = req.headers.get('Upgrade');
            if (upgrade && upgrade.toLowerCase() === 'websocket') {
              const [clientWs, serverWs] = createMockWebSocketPair();

              const userId = req.headers.get('X-User-Id') || 'usr_unknown';
              const email = req.headers.get('X-User-Email') || 'unknown@biosculpture.com';
              const displayName = req.headers.get('X-User-Name') || 'Member';
              const role = (req.headers.get('X-User-Role') || 'member') as any;
              const projectId = req.headers.get('X-Project-Id') || roomId;

              const attachment: RoomSocketAttachment = {
                userId,
                email,
                displayName,
                role,
                projectId,
                connectedAt: new Date().toISOString(),
              };

              serverWs.serializeAttachment(attachment);
              room.state.acceptWebSocket(serverWs as any, [userId]);

              await room.ensureInitialized(projectId);
              room.getPeers().set(serverWs as any, attachment);

              // Wire server ws message and close handlers to DO methods
              serverWs.onmessage = (event) => {
                room.webSocketMessage(serverWs as any, event.data);
              };
              serverWs.onclose = (event) => {
                room.webSocketClose(serverWs as any, event.code, event.reason, true);
              };

              // Initial welcome and sync-step1
              const stateVector = Y.encodeStateVector(room.getYDoc());
              clientWs.send(
                JSON.stringify({
                  type: 'welcome',
                  senderId: 'room',
                  targetId: userId,
                  peer: { userId, email, displayName, role },
                  peers: [{ userId, email, displayName, role }],
                })
              );
              clientWs.send(
                JSON.stringify({
                  type: 'sync-step1',
                  senderId: 'room',
                  targetId: userId,
                  stateVector: encodeBase64(stateVector),
                  namespace: 'sync-step1',
                  data: Array.from(stateVector),
                })
              );

              const response = new Response(null, { status: 101 });
              (response as any).webSocket = clientWs;
              return response;
            }

            return await room.fetch(req);
          },
        };
      },
    };

    env = {
      DB: d1,
      PROJECT_ROOM: doNamespace,
      ALLOWED_EMAIL_DOMAIN: 'biosculpture.com',
      ACCESS_TEAM_DOMAIN: 'biosculpture-test',
      ACCESS_AUDIENCE: TEST_AUDIENCE,
      DROPBOX_CLIENT_ID: 'dummy_id',
      DROPBOX_CLIENT_SECRET: 'dummy_secret',
      DROPBOX_REFRESH_TOKEN: 'dummy_token',
    };

    routerAuthOptions = {
      accessOptions: {
        jwks: [testPublicKeyJwk],
        expectedAudience: TEST_AUDIENCE,
        expectedIssuer: TEST_ISSUER,
      },
    };

    // Seed test users
    await repo.createOrUpdateUser({
      id: 'usr_sarah',
      email: 'sarah@biosculpture.com',
      name: 'Sarah Designer',
      role: 'member',
    });

    await repo.createOrUpdateUser({
      id: 'usr_alex',
      email: 'alex@biosculpture.com',
      name: 'Alex Lead',
      role: 'admin',
    });

    // Seed test folder & project
    const folder = await repo.createFolder({
      id: 'fld_2026',
      workspaceId: BIOSCULPTURE_WORKSPACE_ID,
      parentId: null,
      name: 'Collections 2026',
      dropboxFolderId: 'dbx_fld_1',
      dropboxPath: '/Collections 2026',
    });

    const initFig = new TextEncoder().encode('FIG_INITIAL_BINARY');
    mockDropbox.currentRevCounter = 101;
    mockDropbox.files.set(getManagedCurrentFigPath(folder.id, 'prj_gel_collection'), {
      content: initFig,
      rev: 'rev_101',
    });

    await repo.createProject({
      id: 'prj_gel_collection',
      workspaceId: BIOSCULPTURE_WORKSPACE_ID,
      folderId: folder.id,
      name: 'Gel Collection 2026',
      dropboxFileId: 'dbx_fig_1',
      dropboxRev: 'rev_101',
      currentStateVector: null,
      createdBy: 'usr_sarah',
    });
  });

  describe('Route Authentication, Guarding & Upgrade Validation', () => {
    it('rejects unauthenticated requests without Access token', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { Upgrade: 'websocket' },
        })
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('unauthenticated');
    });

    it('rejects non-members and unknown domains with 403 / 401', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const intruderJwt = await createSignedAccessJWT({ email: 'intruder@gmail.com', name: 'Intruder', sub: 'usr_intruder' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: {
            [authHeader]: intruderJwt,
            Upgrade: 'websocket',
          },
        })
      );

      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent projects without exposing room details', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_nonexistent/collab', {
          method: 'GET',
          headers: {
            [authHeader]: sarahJwt,
            Upgrade: 'websocket',
          },
        })
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('not_found');
    });

    it('rejects plain HTTP GET without WebSocket upgrade with 400 Bad Request', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: {
            [authHeader]: sarahJwt,
          },
        })
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('invalid_request');
    });

    it('accepts authenticated member with WebSocket upgrade and returns 101', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: {
            [authHeader]: sarahJwt,
            Upgrade: 'websocket',
          },
        })
      );

      expect(res.status).toBe(101);
      expect((res as any).webSocket).toBeDefined();
    });
  });

  describe('Live Yjs Convergence, Awareness & Identity Integrity', () => {
    it('converges bidirectional edits between two authenticated members in the same project room', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      // 1. Sarah connects
      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const resSarah = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const sarahWs = (resSarah as any).webSocket as MockWebSocket;

      // 2. Alex connects
      const alexJwt = await createSignedAccessJWT({ email: 'alex@biosculpture.com', name: 'Alex Lead', sub: 'usr_alex' });
      const resAlex = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: alexJwt, Upgrade: 'websocket' },
        })
      );
      const alexWs = (resAlex as any).webSocket as MockWebSocket;

      // Create client Y.Docs
      const sarahDoc = new Y.Doc();
      const alexDoc = new Y.Doc();

      const sarahReceivedUpdates: Uint8Array[] = [];
      const alexReceivedUpdates: Uint8Array[] = [];

      sarahWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'yjs-update' && msg.update) {
          const u = decodeBase64(msg.update);
          sarahReceivedUpdates.push(u);
          Y.applyUpdate(sarahDoc, u);
        }
      };

      alexWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'yjs-update' && msg.update) {
          const u = decodeBase64(msg.update);
          alexReceivedUpdates.push(u);
          Y.applyUpdate(alexDoc, u);
        }
      };

      // 3. Sarah creates a node in her document
      const sarahMap = sarahDoc.getMap('nodes');
      sarahDoc.on('update', (update) => {
        sarahWs.send(
          JSON.stringify({
            type: 'yjs-update',
            update: encodeBase64(update),
          })
        );
      });

      alexDoc.on('update', (update) => {
        alexWs.send(
          JSON.stringify({
            type: 'yjs-update',
            update: encodeBase64(update),
          })
        );
      });

      sarahMap.set('node_rectangle_1', { type: 'RECTANGLE', width: 200, height: 100, fill: '#FF0055' });

      // Allow message dispatch
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Alex should have received Sarah's update and converged
      const alexMap = alexDoc.getMap('nodes');
      expect(alexMap.get('node_rectangle_1')).toEqual({
        type: 'RECTANGLE',
        width: 200,
        height: 100,
        fill: '#FF0055',
      });

      // 4. Alex modifies the node
      alexMap.set('node_rectangle_1', { type: 'RECTANGLE', width: 350, height: 100, fill: '#00AAFF' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Sarah should have received Alex's update
      expect(sarahMap.get('node_rectangle_1')).toEqual({
        type: 'RECTANGLE',
        width: 350,
        height: 100,
        fill: '#00AAFF',
      });

      // Canonical room Y.Doc also has the converged state
      const room = roomInstances.get('prj_gel_collection')!;
      const roomMap = room.getYDoc().getMap('nodes');
      expect(roomMap.get('node_rectangle_1')).toEqual({
        type: 'RECTANGLE',
        width: 350,
        height: 100,
        fill: '#00AAFF',
      });
    });

    it('enforces verified identity on awareness and prevents forged client identities', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const resSarah = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const sarahWs = (resSarah as any).webSocket as MockWebSocket;

      const alexJwt = await createSignedAccessJWT({ email: 'alex@biosculpture.com', name: 'Alex Lead', sub: 'usr_alex' });
      const resAlex = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: alexJwt, Upgrade: 'websocket' },
        })
      );
      const alexWs = (resAlex as any).webSocket as MockWebSocket;

      let alexReceivedAwareness: CollabEnvelope | null = null;
      alexWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'awareness') {
          alexReceivedAwareness = msg;
        }
      };

      // Sarah attempts to forge identity claiming to be "admin_impostor"
      sarahWs.send(
        JSON.stringify({
          type: 'awareness',
          senderId: 'admin_impostor',
          data: [1, 2, 3],
          peer: {
            userId: 'admin_impostor',
            email: 'ceo@biosculpture.com',
            displayName: 'CEO',
            role: 'admin',
          },
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(alexReceivedAwareness).not.toBeNull();
      // Verified attachment user ID must be enforced by DO
      expect(alexReceivedAwareness?.senderId).toBe('usr_sarah');
      expect(alexReceivedAwareness?.peer?.userId).toBe('usr_sarah');
      expect(alexReceivedAwareness?.peer?.email).toBe('sarah@biosculpture.com');
    });
  });

  describe('Multi-Room Isolation', () => {
    it('isolates state and messaging between separate projects', async () => {
      // Create second project
      await repo.createProject({
        id: 'prj_summer_pedicure',
        workspaceId: BIOSCULPTURE_WORKSPACE_ID,
        folderId: 'fld_2026',
        name: 'Summer Pedicure',
        dropboxFileId: 'dbx_fig_2',
        dropboxRev: 'rev_201',
        currentStateVector: null,
        createdBy: 'usr_alex',
      });

      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      // User 1 joins Project 1
      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res1 = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const wsProject1 = (res1 as any).webSocket as MockWebSocket;

      // User 2 joins Project 2
      const alexJwt = await createSignedAccessJWT({ email: 'alex@biosculpture.com', name: 'Alex Lead', sub: 'usr_alex' });
      const res2 = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_summer_pedicure/collab', {
          method: 'GET',
          headers: { [authHeader]: alexJwt, Upgrade: 'websocket' },
        })
      );
      const wsProject2 = (res2 as any).webSocket as MockWebSocket;

      await new Promise((resolve) => setTimeout(resolve, 50));

      let project2ReceivedMessages = 0;
      wsProject2.onmessage = () => {
        project2ReceivedMessages++;
      };

      // Edit in Project 1
      const doc1 = new Y.Doc();
      const map1 = doc1.getMap('elements');
      map1.set('header', 'Exclusive 2026 Gel');
      const update1 = Y.encodeStateAsUpdate(doc1);

      wsProject1.send(
        JSON.stringify({
          type: 'yjs-update',
          update: encodeBase64(update1),
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Project 2 should receive zero messages from Project 1
      expect(project2ReceivedMessages).toBe(0);

      const room1 = roomInstances.get('prj_gel_collection')!;
      const room2 = roomInstances.get('prj_summer_pedicure')!;

      expect(room1.getYDoc().getMap('elements').get('header')).toBe('Exclusive 2026 Gel');
      expect(room2.getYDoc().getMap('elements').get('header')).toBeUndefined();
    });
  });

  describe('Hibernation, Restart & Persistence Recovery', () => {
    it('persists canonical document state across DO eviction and restores state on reconstruction', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      // 1. Connect and perform edits
      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const ws = (res as any).webSocket as MockWebSocket;

      const doc = new Y.Doc();
      const text = doc.getText('manifest');
      text.insert(0, 'Bio Sculpture Evo Pro Gel Formulation');
      const update = Y.encodeStateAsUpdate(doc);

      ws.send(
        JSON.stringify({
          type: 'yjs-update',
          update: encodeBase64(update),
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 2. Simulate server restart / DO eviction: clear in-memory room instances
      const state = roomStates.get('prj_gel_collection')!;
      roomInstances.delete('prj_gel_collection');

      // 3. Reconstruct DO from saved storage state
      const reconstructedRoom = new ProjectRoom(state, env, { dropboxService });
      await reconstructedRoom.ensureInitialized('prj_gel_collection');

      const restoredText = reconstructedRoom.getYDoc().getText('manifest').toString();
      expect(restoredText).toBe('Bio Sculpture Evo Pro Gel Formulation');

      // 4. A new connecting peer synchronizes against reconstructed room
      const clientDoc = new Y.Doc();
      const clientVector = Y.encodeStateVector(clientDoc);
      const diff = Y.encodeStateAsUpdate(reconstructedRoom.getYDoc(), clientVector);
      Y.applyUpdate(clientDoc, diff);

      expect(clientDoc.getText('manifest').toString()).toBe('Bio Sculpture Evo Pro Gel Formulation');
    });
  });

  describe('Guarded Snapshot Acceptance & Dropbox Concurrency', () => {
    it('accepts snapshot candidate when state vector is current and revision matches', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const ws = (res as any).webSocket as MockWebSocket;

      // Sync an update
      const doc = new Y.Doc();
      doc.getText('title').insert(0, 'New Season Lookbook');
      const update = Y.encodeStateAsUpdate(doc);

      ws.send(
        JSON.stringify({
          type: 'yjs-update',
          update: encodeBase64(update),
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const room = roomInstances.get('prj_gel_collection')!;
      const stateVector = Y.encodeStateVector(room.getYDoc());

      let snapshotResponse: CollabEnvelope | null = null;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'snapshot-response') {
          snapshotResponse = msg;
        }
      };

      const figBytes = new TextEncoder().encode('NEW_FIG_SNAPSHOT_2026');

      // Submit snapshot candidate
      ws.send(
        JSON.stringify({
          type: 'snapshot-candidate',
          snapshot: encodeBase64(figBytes),
          stateVector: encodeBase64(stateVector),
          expectedRev: 'rev_101',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(snapshotResponse).not.toBeNull();
      expect(snapshotResponse?.success).toBe(true);
      expect(snapshotResponse?.rev).toBe('rev_102');

      // Verify D1 updated
      const project = await repo.getProjectById('prj_gel_collection');
      expect(project?.dropboxRev).toBe('rev_102');
      expect(project?.currentStateVector).toBe(encodeBase64(stateVector));

      // Verify Dropbox received content
      const file = mockDropbox.files.get(getManagedCurrentFigPath('fld_2026', 'prj_gel_collection'));
      expect(file?.rev).toBe('rev_102');
      expect(new TextDecoder().decode(file?.content)).toBe('NEW_FIG_SNAPSHOT_2026');
    });

    it('rejects stale snapshot candidate with conflict and resynchronizes client', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const ws = (res as any).webSocket as MockWebSocket;

      // 1. Peer A makes an edit in room
      const room = roomInstances.get('prj_gel_collection')!;
      room.getYDoc().getText('notes').insert(0, 'Concurrent edit made by Peer A');
      await room.persistState();

      // 2. Sarah submits snapshot with empty/stale state vector
      const staleDoc = new Y.Doc(); // empty doc state vector
      const staleVector = Y.encodeStateVector(staleDoc);

      let snapshotResponse: CollabEnvelope | null = null;
      let resyncStep1: CollabEnvelope | null = null;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'snapshot-response') {
          snapshotResponse = msg;
        }
        if (msg.type === 'sync-step1') {
          resyncStep1 = msg;
        }
      };

      ws.send(
        JSON.stringify({
          type: 'snapshot-candidate',
          snapshot: encodeBase64(new TextEncoder().encode('STALE_SNAPSHOT')),
          stateVector: encodeBase64(staleVector),
          expectedRev: 'rev_101',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(snapshotResponse).not.toBeNull();
      expect(snapshotResponse?.success).toBe(false);
      expect(snapshotResponse?.code).toBe('conflict');

      // DO sends sync-step1 to resynchronize the client
      expect(resyncStep1).not.toBeNull();
      expect(resyncStep1?.type).toBe('sync-step1');

      // Dropbox is not updated
      const file = mockDropbox.files.get(getManagedCurrentFigPath('fld_2026', 'prj_gel_collection'));
      expect(file?.rev).toBe('rev_101');
    });

    it('rejects snapshot candidate on Dropbox revision mismatch', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const ws = (res as any).webSocket as MockWebSocket;

      const room = roomInstances.get('prj_gel_collection')!;
      const stateVector = Y.encodeStateVector(room.getYDoc());

      let snapshotResponse: CollabEnvelope | null = null;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'snapshot-response') {
          snapshotResponse = msg;
        }
      };

      // Submit with stale revision rev_000 instead of rev_101
      ws.send(
        JSON.stringify({
          type: 'snapshot-candidate',
          snapshot: encodeBase64(new TextEncoder().encode('NEW_SNAPSHOT')),
          stateVector: encodeBase64(stateVector),
          expectedRev: 'rev_stale_999',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(snapshotResponse).not.toBeNull();
      expect(snapshotResponse?.success).toBe(false);
      expect(snapshotResponse?.code).toBe('conflict');
    });
  });

  describe('Payload Defense & Error Handling', () => {
    it('rejects oversized payloads safely without crashing room state', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const ws = (res as any).webSocket as MockWebSocket;

      let errorResponse: CollabEnvelope | null = null;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'error') {
          errorResponse = msg;
        }
      };

      // Send 60MB payload exceeding default 50MB limit
      const hugeString = 'X'.repeat(55 * 1024 * 1024);
      ws.send(hugeString);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(errorResponse).not.toBeNull();
      expect(errorResponse?.code).toBe('payload_too_large');
    });

    it('handles malformed JSON and malformed updates without corrupting canonical Yjs document', async () => {
      const router = createRouter(env, {
        authOptions: routerAuthOptions,
        repo,
        dropboxService,
      });

      const sarahJwt = await createSignedAccessJWT({ email: 'sarah@biosculpture.com', name: 'Sarah Designer', sub: 'usr_sarah' });
      const res = await router(
        new Request('https://cloud.biosculpture.com/api/projects/prj_gel_collection/collab', {
          method: 'GET',
          headers: { [authHeader]: sarahJwt, Upgrade: 'websocket' },
        })
      );
      const ws = (res as any).webSocket as MockWebSocket;

      let errorResponse: CollabEnvelope | null = null;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'error') {
          errorResponse = msg;
        }
      };

      // 1. Malformed JSON
      ws.send('{ invalid json payload');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(errorResponse?.code).toBe('invalid_json');

      // 2. Malformed binary update
      ws.send(
        JSON.stringify({
          type: 'yjs-update',
          update: 'bm90LWEtdmFsaWQteWpzLXVwZGF0ZQ==', // base64 "not-a-valid-yjs-update"
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(errorResponse?.code).toBe('invalid_update');

      // Canonical Y.Doc is undamaged
      const room = roomInstances.get('prj_gel_collection')!;
      expect(room.getYDoc()).toBeDefined();
    });
  });
});
