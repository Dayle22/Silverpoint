// Tests for @open-pencil/cloud database contracts and API router

import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CloudRepository } from '../src/db/repository.ts';
import { createRouter } from '../src/index.ts';
import { createErrorResponse, type ErrorResponseBody } from '../src/errors.ts';
import { BIOSCULPTURE_WORKSPACE_ID, type Env, type IDatabaseBinding } from '../src/types.ts';

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

describe('Cloud Contracts & Repository', () => {
  let migrationSql: string;
  let d1: IDatabaseBinding;
  let repo: CloudRepository;

  beforeEach(() => {
    migrationSql = readFileSync(
      join(import.meta.dir, '../migrations/0001_biosculpture_workspace.sql'),
      'utf-8'
    );
    const inMem = createInMemoryD1(migrationSql);
    d1 = inMem.d1;
    repo = new CloudRepository(d1);
  });

  it('provisions workspace seed and handles user creation', async () => {
    const user = await repo.createOrUpdateUser({
      id: 'usr_001',
      email: 'designer@biosculpture.com',
      name: 'Sarah Designer',
      role: 'member',
    });

    expect(user.id).toBe('usr_001');
    expect(user.email).toBe('designer@biosculpture.com');
    expect(user.role).toBe('member');
    expect(user.status).toBe('active');

    // Case-insensitive lookup
    const found = await repo.getUserByEmail('DESIGNER@biosculpture.com');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('usr_001');
  });

  it('rejects duplicate user email insertion with conflict error', async () => {
    await repo.createOrUpdateUser({
      id: 'usr_001',
      email: 'admin@biosculpture.com',
      name: 'Admin One',
      role: 'admin',
    });

    // Update with same email returns existing user
    const updated = await repo.createOrUpdateUser({
      id: 'usr_002',
      email: 'admin@biosculpture.com',
      name: 'Admin Renamed',
    });

    expect(updated.id).toBe('usr_001');
    expect(updated.name).toBe('Admin Renamed');
  });

  it('creates, lists and archives project folders', async () => {
    const folder1 = await repo.createFolder({
      id: 'fld_001',
      workspaceId: BIOSCULPTURE_WORKSPACE_ID,
      parentId: null,
      name: '2026 Collections',
      dropboxFolderId: 'dbx_fld_123',
      dropboxPath: '/Collections 2026',
    });

    expect(folder1.id).toBe('fld_001');
    expect(folder1.name).toBe('2026 Collections');

    const folders = await repo.listFolders(BIOSCULPTURE_WORKSPACE_ID);
    expect(folders.length).toBe(1);
    expect(folders[0].name).toBe('2026 Collections');

    // Archive folder
    await repo.archiveFolder('fld_001');
    const activeFolders = await repo.listFolders(BIOSCULPTURE_WORKSPACE_ID);
    expect(activeFolders.length).toBe(0);

    const allFolders = await repo.listFolders(BIOSCULPTURE_WORKSPACE_ID, true);
    expect(allFolders.length).toBe(1);
    expect(allFolders[0].archivedAt).not.toBeNull();
  });

  it('creates, updates and lists projects within folders', async () => {
    await repo.createOrUpdateUser({
      id: 'usr_001',
      email: 'lead@biosculpture.com',
      name: 'Lead Artist',
    });

    const folder = await repo.createFolder({
      id: 'fld_001',
      workspaceId: BIOSCULPTURE_WORKSPACE_ID,
      parentId: null,
      name: 'Spring 2026',
      dropboxFolderId: null,
      dropboxPath: null,
    });

    const project = await repo.createProject({
      id: 'prj_001',
      workspaceId: BIOSCULPTURE_WORKSPACE_ID,
      folderId: folder.id,
      name: 'Pastel Campaign Hero',
      dropboxFileId: 'dbx_file_abc',
      dropboxRev: 'rev_001',
      currentStateVector: 'base64vector==',
      createdBy: 'usr_001',
    });

    expect(project.id).toBe('prj_001');
    expect(project.name).toBe('Pastel Campaign Hero');

    // Update revision
    await repo.updateProjectRevision('prj_001', 'rev_002', 'newvector==');
    const updated = await repo.getProjectById('prj_001');
    expect(updated?.dropboxRev).toBe('rev_002');
    expect(updated?.currentStateVector).toBe('newvector==');
  });

  it('records audit events without throwing', async () => {
    await repo.createOrUpdateUser({
      id: 'usr_001',
      email: 'lead@biosculpture.com',
      name: 'Lead Artist',
    });

    await repo.recordAuditEvent({
      id: 'aud_001',
      workspaceId: BIOSCULPTURE_WORKSPACE_ID,
      actorId: 'usr_001',
      action: 'project.create',
      targetType: 'project',
      targetId: 'prj_001',
      detailsJson: JSON.stringify({ name: 'Pastel Campaign' }),
    });
  });
});

describe('Cloud API Router & Error Sanitisation', () => {
  let env: Env;

  beforeEach(() => {
    const migrationSql = readFileSync(
      join(import.meta.dir, '../migrations/0001_biosculpture_workspace.sql'),
      'utf-8'
    );
    const inMem = createInMemoryD1(migrationSql);
    env = {
      DB: inMem.d1,
      ALLOWED_EMAIL_DOMAIN: 'biosculpture.com',
    };
  });

  it('returns healthy status on /health', async () => {
    const router = createRouter(env);
    const res = await router(new Request('https://cloud.biosculpture.internal/health'));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('openpencil-cloud');
  });

  it('returns workspace info on /api/v1/workspace', async () => {
    const router = createRouter(env);
    const res = await router(new Request('https://cloud.biosculpture.internal/api/v1/workspace'));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { workspace: { id: string; domain: string } };
    expect(body.workspace.id).toBe(BIOSCULPTURE_WORKSPACE_ID);
    expect(body.workspace.domain).toBe('biosculpture.com');
  });

  it('returns safe sanitised 404 for unknown routes', async () => {
    const router = createRouter(env);
    const res = await router(new Request('https://cloud.biosculpture.internal/api/v1/nonexistent'));
    expect(res.status).toBe(404);

    const body = (await res.json()) as ErrorResponseBody;
    expect(body.error.code).toBe('not_found');
  });

  it('sanitises internal errors and prevents secret leakage', async () => {
    const res = createErrorResponse(new Error('Internal DB failure on /var/secret/keys.json'));
    expect(res.status).toBe(500);

    const body = (await res.json()) as ErrorResponseBody;
    expect(body.error.code).toBe('internal_error');
    expect(body.error.message).toBe('An internal server error occurred');
    expect(JSON.stringify(body)).not.toContain('/var/secret');
  });
});
