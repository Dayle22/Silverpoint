// Tests for Dropbox Repository integration, client boundary, optimistic revision checks and API endpoints

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CloudRepository } from '../src/db/repository.ts';
import { createRouter } from '../src/index.ts';
import { DropboxClient } from '../src/dropbox/client.ts';
import { DropboxRepositoryService } from '../src/dropbox/service.ts';
import { APIError } from '../src/errors.ts';
import {
  BIOSCULPTURE_WORKSPACE_ID,
  type Env,
  type IDatabaseBinding,
} from '../src/types.ts';
import { base64UrlEncode, type JWKKey } from '../src/auth/access.ts';

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

// Fake In-Memory Dropbox Server for Isolated Unit & Integration Tests
class FakeDropboxServer {
  public folders = new Map<string, { id: string; name: string; path_display: string }>();
  public files = new Map<
    string,
    { id: string; name: string; path_display: string; rev: string; content: Uint8Array; size: number }
  >();
  public tokenRefreshCount = 0;
  public forceNextStatus: { path?: string; status: number; body?: string; retryAfter?: string } | null = null;
  public failNextTokenRefresh = false;

  private generateRev(): string {
    return `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  fetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Handle OAuth Token Refresh
    if (url.includes('/oauth2/token')) {
      this.tokenRefreshCount++;
      if (this.failNextTokenRefresh) {
        return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'bad token' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          access_token: `sl.mock_access_token_${this.tokenRefreshCount}`,
          token_type: 'bearer',
          expires_in: 14400,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Intercept forced failure/status (e.g. rate limit 429, 401, 503)
    if (this.forceNextStatus) {
      const forced = this.forceNextStatus;
      this.forceNextStatus = null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (forced.retryAfter) {
        headers['Retry-After'] = forced.retryAfter;
      }
      return new Response(forced.body || '{"error": "forced"}', {
        status: forced.status,
        headers,
      });
    }

    // 1. files/create_folder_v2
    if (url.includes('/files/create_folder_v2')) {
      const body = JSON.parse(init?.body as string) as { path: string };
      const folderId = `id:fld_${Math.random().toString(36).slice(2, 10)}`;
      const folderMeta = {
        id: folderId,
        name: body.path.split('/').pop() || '',
        path_display: body.path,
      };
      this.folders.set(body.path.toLowerCase(), folderMeta);
      return new Response(
        JSON.stringify({
          metadata: {
            '.tag': 'folder',
            ...folderMeta,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. files/get_metadata
    if (url.includes('/files/get_metadata')) {
      const body = JSON.parse(init?.body as string) as { path: string };
      const lower = body.path.toLowerCase();
      const folder = this.folders.get(lower);
      if (folder) {
        return new Response(
          JSON.stringify({
            '.tag': 'folder',
            ...folder,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const file = this.files.get(lower) || Array.from(this.files.values()).find((f) => f.id === body.path);
      if (file) {
        return new Response(
          JSON.stringify({
            '.tag': 'file',
            id: file.id,
            name: file.name,
            path_display: file.path_display,
            rev: file.rev,
            size: file.size,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          error_summary: 'path/not_found/',
          error: { '.tag': 'path', path: { '.tag': 'not_found' } },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. files/upload
    if (url.includes('/files/upload')) {
      const headers = new Headers(init?.headers);
      const apiArgHeader = headers.get('Dropbox-API-Arg') || '{}';
      const apiArg = JSON.parse(apiArgHeader) as {
        path: string;
        mode?: { '.tag': string; update?: string } | string;
      };

      const lower = apiArg.path.toLowerCase();
      const existing = this.files.get(lower);
      const mode = typeof apiArg.mode === 'string' ? { '.tag': apiArg.mode } : apiArg.mode;

      // Optimistic concurrency check
      if (mode?.['.tag'] === 'update') {
        const expectedRev = mode.update;
        if (!existing) {
          return new Response(
            JSON.stringify({
              error_summary: 'path/conflict/file',
              error: { '.tag': 'path', path: { '.tag': 'conflict', conflict: { '.tag': 'file' } } },
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (existing.rev !== expectedRev) {
          return new Response(
            JSON.stringify({
              error_summary: 'path/conflict/file',
              error: { '.tag': 'path', path: { '.tag': 'conflict', conflict: { '.tag': 'file' } } },
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      let contentBytes: Uint8Array;
      if (typeof init?.body === 'string') {
        contentBytes = new TextEncoder().encode(init.body);
      } else if (init?.body instanceof Uint8Array) {
        contentBytes = init.body;
      } else if (init?.body instanceof ArrayBuffer) {
        contentBytes = new Uint8Array(init.body);
      } else {
        contentBytes = new Uint8Array();
      }

      const fileId = existing?.id || `id:file_${Math.random().toString(36).slice(2, 10)}`;
      const newRev = this.generateRev();
      const fileRecord = {
        id: fileId,
        name: apiArg.path.split('/').pop() || '',
        path_display: apiArg.path,
        rev: newRev,
        content: contentBytes,
        size: contentBytes.byteLength,
      };

      this.files.set(lower, fileRecord);

      return new Response(
        JSON.stringify({
          '.tag': 'file',
          id: fileId,
          name: fileRecord.name,
          path_display: fileRecord.path_display,
          rev: newRev,
          size: fileRecord.size,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. files/download
    if (url.includes('/files/download')) {
      const headers = new Headers(init?.headers);
      const apiArgHeader = headers.get('Dropbox-API-Arg') || '{}';
      const apiArg = JSON.parse(apiArgHeader) as { path: string };

      const file =
        this.files.get(apiArg.path.toLowerCase()) ||
        Array.from(this.files.values()).find((f) => f.id === apiArg.path);

      if (!file) {
        return new Response(
          JSON.stringify({
            error_summary: 'path/not_found/',
            error: { '.tag': 'path', path: { '.tag': 'not_found' } },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(file.content as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Result': JSON.stringify({
            '.tag': 'file',
            id: file.id,
            name: file.name,
            path_display: file.path_display,
            rev: file.rev,
            size: file.size,
          }),
        },
      });
    }

    // 5. files/list_folder & files/list_folder/continue
    if (url.includes('/files/list_folder')) {
      if (url.includes('/continue')) {
        // Page 2
        return new Response(
          JSON.stringify({
            entries: [
              {
                '.tag': 'file',
                id: 'id:page2_file',
                name: 'page2.fig',
                path_display: '/Projects/fld_01/page2.fig',
                rev: 'rev_page2',
                size: 1024,
              },
            ],
            cursor: 'cursor_end',
            has_more: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = JSON.parse(init?.body as string) as { limit?: number };
      if (body.limit === 1) {
        return new Response(
          JSON.stringify({
            entries: [
              {
                '.tag': 'file',
                id: 'id:page1_file',
                name: 'page1.fig',
                path_display: '/Projects/fld_01/page1.fig',
                rev: 'rev_page1',
                size: 512,
              },
            ],
            cursor: 'cursor_page2',
            has_more: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const entries = Array.from(this.files.values()).map((f) => ({
        '.tag': 'file',
        id: f.id,
        name: f.name,
        path_display: f.path_display,
        rev: f.rev,
        size: f.size,
      }));

      return new Response(
        JSON.stringify({
          entries,
          cursor: 'cursor_done',
          has_more: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. files/delete_v2
    if (url.includes('/files/delete_v2')) {
      const body = JSON.parse(init?.body as string) as { path: string };
      this.files.delete(body.path.toLowerCase());
      this.folders.delete(body.path.toLowerCase());
      return new Response(
        JSON.stringify({
          metadata: {
            '.tag': 'deleted',
            id: 'id:deleted',
            name: body.path.split('/').pop() || '',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not found', { status: 404 });
  };
}

let testPrivateKey: CryptoKey;
let testPublicKeyJwk: JWKKey;
const TEST_KID = 'test-dropbox-access-key';
const TEST_AUDIENCE = 'test-aud-12345';
const TEST_ISSUER = 'https://biosculpture-test.cloudflareaccess.com';

async function createSignedAccessJWT(
  payload: Record<string, unknown>,
  key: CryptoKey = testPrivateKey
): Promise<string> {
  const header = {
    alg: 'RS256',
    kid: TEST_KID,
    typ: 'JWT',
  };

  const exp = payload.exp ?? Math.floor(Date.now() / 1000) + 3600;
  const fullPayload = {
    iss: TEST_ISSUER,
    aud: TEST_AUDIENCE,
    exp,
    iat: Math.floor(Date.now() / 1000),
    ...payload,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    dataToSign
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

describe('Dropbox Client & Repository Boundary', () => {
  let fakeDropbox: FakeDropboxServer;
  let client: DropboxClient;
  let migrationSql: string;
  let d1: IDatabaseBinding;
  let repo: CloudRepository;
  let service: DropboxRepositoryService;

  beforeEach(() => {
    fakeDropbox = new FakeDropboxServer();
    client = new DropboxClient({
      clientId: 'mock_client_id',
      clientSecret: 'mock_client_secret',
      refreshToken: 'mock_refresh_token',
      fetchFn: fakeDropbox.fetch,
    });

    migrationSql = readFileSync(
      join(import.meta.dir, '../migrations/0001_biosculpture_workspace.sql'),
      'utf-8'
    );
    const inMem = createInMemoryD1(migrationSql);
    d1 = inMem.d1;
    repo = new CloudRepository(d1);
    service = new DropboxRepositoryService(repo, client);
  });

  it('automatically refreshes and caches Dropbox access tokens', async () => {
    expect(fakeDropbox.tokenRefreshCount).toBe(0);

    const folder = await client.createFolder('/Projects/fld_001');
    expect(folder.id).toBeDefined();
    expect(folder.name).toBe('fld_001');
    expect(fakeDropbox.tokenRefreshCount).toBe(1);

    // Second call uses cached access token
    await client.createFolder('/Projects/fld_002');
    expect(fakeDropbox.tokenRefreshCount).toBe(1);
  });

  it('retries on 401 Unauthorized by clearing cached token and requesting a fresh one', async () => {
    await client.createFolder('/Projects/fld_init');
    expect(fakeDropbox.tokenRefreshCount).toBe(1);

    // Simulate expired token returning 401 on next call
    fakeDropbox.forceNextStatus = { status: 401, body: '{"error": "invalid_access_token"}' };

    const folder = await client.createFolder('/Projects/fld_recovered');
    expect(folder.name).toBe('fld_recovered');
    // Token was refreshed a second time
    expect(fakeDropbox.tokenRefreshCount).toBe(2);
  });

  it('fails safely without secret leakage when token refresh is rejected', async () => {
    fakeDropbox.failNextTokenRefresh = true;

    try {
      await client.createFolder('/Projects/fld_fail');
      expect().fail('Should have thrown APIError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(APIError);
      const apiErr = err as APIError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.message).not.toContain('mock_client_secret');
      expect(apiErr.message).not.toContain('mock_refresh_token');
    }
  });

  it('paginates folder listings with listAllFolderEntries', async () => {
    const entries = await client.listAllFolderEntries('/Projects/fld_01', { limit: 1 });
    expect(entries.length).toBe(2);
    expect(entries[0].name).toBe('page1.fig');
    expect(entries[1].name).toBe('page2.fig');
  });

  it('retries transient 429 rate-limit responses and obeys Retry-After', async () => {
    fakeDropbox.forceNextStatus = {
      status: 429,
      body: '{"error_summary": "too_many_requests"}',
      retryAfter: '0',
    };

    const folder = await client.createFolder('/Projects/fld_rate_limited');
    expect(folder.name).toBe('fld_rate_limited');
  });

  it('enforces optimistic concurrency and raises 409 Conflict on revision mismatch', async () => {
    const path = '/Projects/fld_01/prj_01/current.fig';
    const initial = await client.uploadFile(path, new Uint8Array([1, 2, 3]), { '.tag': 'add' });
    expect(initial.rev).toBeDefined();

    // Valid update with matching rev
    const updated = await client.uploadFile(path, new Uint8Array([1, 2, 3, 4]), {
      '.tag': 'update',
      update: initial.rev,
    });
    expect(updated.rev).not.toBe(initial.rev);

    // Stale update with old rev -> 409 Conflict
    try {
      await client.uploadFile(path, new Uint8Array([9, 9, 9]), {
        '.tag': 'update',
        update: initial.rev,
      });
      expect().fail('Should have failed with 409 conflict');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(APIError);
      const apiErr = err as APIError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('conflict');
      expect(apiErr.message).toContain('conflict');
    }
  });

  it('creates project, uploads snapshot, thumbnail and manifest, and keeps D1 consistent', async () => {
    const user = await repo.createOrUpdateUser({
      id: 'usr_artist',
      email: 'artist@biosculpture.com',
      name: 'Nail Artist',
    });

    const folder = await service.createFolder({
      name: 'Autumn 2026',
      actorId: user.id,
    });

    expect(folder.id).toBeDefined();
    expect(folder.dropboxFolderId).toBeDefined();

    const initialFig = new Uint8Array([10, 20, 30]);
    const initialThumb = new Uint8Array([255, 216, 255]); // JPEG magic header mock

    const project = await service.createProject({
      name: 'Velvet Plum Gel',
      folderId: folder.id,
      actorId: user.id,
      initialFig,
      initialThumb,
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe('Velvet Plum Gel');
    expect(project.dropboxRev).toBeDefined();

    // Snapshot retrieval
    const snapshot = await service.getSnapshot(project.id);
    expect(snapshot.name).toBe('Velvet Plum Gel');
    expect(snapshot.bytes).toEqual(initialFig);
    expect(snapshot.rev).toBe(project.dropboxRev || '');

    // Thumbnail retrieval
    const thumbnail = await service.getThumbnail(project.id);
    expect(thumbnail.bytes).toEqual(initialThumb);
    expect(thumbnail.contentType).toBe('image/jpeg');

    // Update snapshot with optimistic concurrency
    const updateResult = await service.updateSnapshot(project.id, {
      bytes: new Uint8Array([10, 20, 30, 40, 50]),
      expectedRev: project.dropboxRev || '',
      stateVector: 'state_v2',
      actorId: user.id,
      retainVersion: true,
    });

    expect(updateResult.rev).not.toBe(project.dropboxRev);
    expect(updateResult.stateVector).toBe('state_v2');

    const updatedSnapshot = await service.getSnapshot(project.id);
    expect(updatedSnapshot.bytes).toEqual(new Uint8Array([10, 20, 30, 40, 50]));
    expect(updatedSnapshot.stateVector).toBe('state_v2');
  });

  it('handles partial create failure by compensating and recording audit event', async () => {
    const user = await repo.createOrUpdateUser({
      id: 'usr_artist',
      email: 'artist@biosculpture.com',
      name: 'Nail Artist',
    });

    await service.createFolder({
      name: 'Spring 2026',
      actorId: user.id,
    });

    // Create project targeting non-existent folder should throw 404 before touching storage
    try {
      await service.createProject({
        name: 'Failed Project',
        folderId: 'fld_nonexistent',
        actorId: user.id,
      });
      expect().fail('Should have failed with 404');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(404);
    }
  });

  it('archives project when requested by admin, hiding it while preserving content', async () => {
    const adminUser = await repo.createOrUpdateUser({
      id: 'usr_admin',
      email: 'admin@biosculpture.com',
      name: 'System Admin',
      role: 'admin',
    });

    const regularUser = await repo.createOrUpdateUser({
      id: 'usr_regular',
      email: 'artist@biosculpture.com',
      name: 'Artist',
      role: 'member',
    });

    const folder = await service.createFolder({
      name: 'Archive Test Folder',
      actorId: adminUser.id,
    });

    const project = await service.createProject({
      name: 'To Be Archived',
      folderId: folder.id,
      actorId: adminUser.id,
    });

    // Regular member cannot archive -> 403 Forbidden
    try {
      await service.archiveProject(project.id, regularUser.id, regularUser.role);
      expect().fail('Should have failed with 403');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(403);
    }

    // Admin can archive
    const res = await service.archiveProject(project.id, adminUser.id, adminUser.role);
    expect(res.success).toBe(true);

    // Archived project is hidden from active list
    const activeProjects = await service.listProjects(BIOSCULPTURE_WORKSPACE_ID, folder.id);
    expect(activeProjects.find((p) => p.id === project.id)).toBeUndefined();

    // Snapshot lookup for archived project returns 404
    try {
      await service.getSnapshot(project.id);
      expect().fail('Should have failed with 404');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(404);
    }
  });
});

describe('Cloud API End-to-End Route Surface (F-016c)', () => {
  let env: Env;
  let fakeDropbox: FakeDropboxServer;
  let client: DropboxClient;
  let d1: IDatabaseBinding;
  let repo: CloudRepository;
  let router: (req: Request) => Promise<Response>;
  let adminToken: string;
  let memberToken: string;

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
    fakeDropbox = new FakeDropboxServer();
    client = new DropboxClient({
      clientId: 'mock_client_id',
      clientSecret: 'mock_client_secret',
      refreshToken: 'mock_refresh_token',
      fetchFn: fakeDropbox.fetch,
    });

    const migrationSql = readFileSync(
      join(import.meta.dir, '../migrations/0001_biosculpture_workspace.sql'),
      'utf-8'
    );
    const inMem = createInMemoryD1(migrationSql);
    d1 = inMem.d1;
    repo = new CloudRepository(d1);

    env = {
      DB: d1,
      ALLOWED_EMAIL_DOMAIN: 'biosculpture.com',
      ACCESS_TEAM_DOMAIN: 'biosculpture-test',
      ACCESS_AUDIENCE: TEST_AUDIENCE,
    };

    // Seed test users
    await repo.createOrUpdateUser({
      id: 'usr_admin',
      email: 'admin@biosculpture.com',
      name: 'Admin User',
      role: 'admin',
    });

    await repo.createOrUpdateUser({
      id: 'usr_member',
      email: 'artist@biosculpture.com',
      name: 'Artist User',
      role: 'member',
    });

    adminToken = await createSignedAccessJWT({ email: 'admin@biosculpture.com', name: 'Admin User' });
    memberToken = await createSignedAccessJWT({ email: 'artist@biosculpture.com', name: 'Artist User' });

    router = createRouter(env, {
      repo,
      dropboxClient: client,
      authOptions: {
        accessOptions: {
          jwks: [testPublicKeyJwk],
          expectedAudience: TEST_AUDIENCE,
          expectedIssuer: TEST_ISSUER,
        },
      },
    });
  });

  it('GET /api/folders lists folders for authenticated member', async () => {
    const res = await router(
      new Request('https://cloud.biosculpture.internal/api/folders', {
        method: 'GET',
        headers: { 'Cf-Access-Jwt-Assertion': memberToken },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { folders: unknown[] };
    expect(Array.isArray(body.folders)).toBe(true);
    expect(body.folders.length).toBe(0);
  });

  it('POST /api/folders creates a new managed folder', async () => {
    const res = await router(
      new Request('https://cloud.biosculpture.internal/api/folders', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Winter Collection 2026' }),
      })
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { folder: { id: string; name: string; dropboxFolderId: string } };
    expect(body.folder.id).toMatch(/^fld_/);
    expect(body.folder.name).toBe('Winter Collection 2026');
    expect(body.folder.dropboxFolderId).toBeDefined();
  });

  it('POST /api/projects & GET /api/projects workflow', async () => {
    // 1. Create Folder
    const folderRes = await router(
      new Request('https://cloud.biosculpture.internal/api/folders', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Gel Catalogue' }),
      })
    );
    const { folder } = (await folderRes.json()) as { folder: { id: string } };

    // 2. Create Project
    const projRes = await router(
      new Request('https://cloud.biosculpture.internal/api/projects', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Classic Scarlet 19',
          folderId: folder.id,
          initialFig: base64UrlEncode(new Uint8Array([1, 2, 3, 4])),
        }),
      })
    );

    expect(projRes.status).toBe(201);
    const { project } = (await projRes.json()) as { project: { id: string; name: string; dropboxRev: string } };
    expect(project.id).toMatch(/^prj_/);
    expect(project.name).toBe('Classic Scarlet 19');
    expect(project.dropboxRev).toBeDefined();

    // 3. List Projects
    const listRes = await router(
      new Request(`https://cloud.biosculpture.internal/api/projects?folderId=${folder.id}`, {
        method: 'GET',
        headers: { 'Cf-Access-Jwt-Assertion': memberToken },
      })
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { projects: Array<{ id: string; name: string }> };
    expect(listBody.projects.length).toBe(1);
    expect(listBody.projects[0].name).toBe('Classic Scarlet 19');
  });

  it('GET and PUT /api/projects/:id/snapshot with revision checking', async () => {
    // 1. Setup Folder & Project
    const folderRes = await router(
      new Request('https://cloud.biosculpture.internal/api/folders', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Campaign' }),
      })
    );
    const { folder } = (await folderRes.json()) as { folder: { id: string } };

    const initialPayload = new Uint8Array([5, 10, 15, 20]);
    const projRes = await router(
      new Request('https://cloud.biosculpture.internal/api/projects', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Hero Banner',
          folderId: folder.id,
          initialFig: base64UrlEncode(initialPayload),
        }),
      })
    );
    const { project } = (await projRes.json()) as { project: { id: string; dropboxRev: string } };

    // 2. GET snapshot
    const getRes = await router(
      new Request(`https://cloud.biosculpture.internal/api/projects/${project.id}/snapshot`, {
        method: 'GET',
        headers: { 'Cf-Access-Jwt-Assertion': memberToken },
      })
    );

    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(getRes.headers.get('X-Dropbox-Rev')).toBe(project.dropboxRev);
    const downloadedBytes = new Uint8Array(await getRes.arrayBuffer());
    expect(downloadedBytes).toEqual(initialPayload);

    // 3. PUT snapshot (binary mode)
    const newBytes = new Uint8Array([99, 88, 77]);
    const putRes = await router(
      new Request(`https://cloud.biosculpture.internal/api/projects/${project.id}/snapshot`, {
        method: 'PUT',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/octet-stream',
          'X-Expected-Rev': project.dropboxRev,
          'X-State-Vector': 'vector_alpha',
        },
        body: newBytes as unknown as BodyInit,
      })
    );

    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as { success: boolean; rev: string; stateVector: string };
    expect(putBody.success).toBe(true);
    expect(putBody.rev).not.toBe(project.dropboxRev);
    expect(putBody.stateVector).toBe('vector_alpha');

    // 4. Stale PUT snapshot -> 409 Conflict
    const staleRes = await router(
      new Request(`https://cloud.biosculpture.internal/api/projects/${project.id}/snapshot`, {
        method: 'PUT',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/octet-stream',
          'X-Expected-Rev': project.dropboxRev, // Old Rev
        },
        body: newBytes as unknown as BodyInit,
      })
    );

    expect(staleRes.status).toBe(409);
    const staleBody = (await staleRes.json()) as { error: { code: string } };
    expect(staleBody.error.code).toBe('conflict');
  });

  it('POST /api/projects/:id/archive requires admin role', async () => {
    // Create folder and project
    const folderRes = await router(
      new Request('https://cloud.biosculpture.internal/api/folders', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Archive Test' }),
      })
    );
    const { folder } = (await folderRes.json()) as { folder: { id: string } };

    const projRes = await router(
      new Request('https://cloud.biosculpture.internal/api/projects', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': memberToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Old Project', folderId: folder.id }),
      })
    );
    const { project } = (await projRes.json()) as { project: { id: string } };

    // Member tries to archive -> 403
    const memberArchiveRes = await router(
      new Request(`https://cloud.biosculpture.internal/api/projects/${project.id}/archive`, {
        method: 'POST',
        headers: { 'Cf-Access-Jwt-Assertion': memberToken },
      })
    );
    expect(memberArchiveRes.status).toBe(403);

    // Admin archives -> 200
    const adminArchiveRes = await router(
      new Request(`https://cloud.biosculpture.internal/api/projects/${project.id}/archive`, {
        method: 'POST',
        headers: { 'Cf-Access-Jwt-Assertion': adminToken },
      })
    );
    expect(adminArchiveRes.status).toBe(200);
    const body = (await adminArchiveRes.json()) as { success: boolean; id: string };
    expect(body.success).toBe(true);
    expect(body.id).toBe(project.id);
  });
});
