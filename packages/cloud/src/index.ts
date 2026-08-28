// Cloudflare Worker API entry point for @open-pencil/cloud

import { type Env, BIOSCULPTURE_WORKSPACE_ID } from './types.ts';
import { APIError, createErrorResponse, jsonResponse } from './errors.ts';
import { CloudRepository } from './db/repository.ts';
import {
  handleGetSessionMe,
  handlePostSessionBootstrap,
  authenticateUser,
  type BootstrapRequestBody,
  type RouteAuthOptions,
} from './auth/session.ts';
import { DropboxClient, type IDropboxClient } from './dropbox/client.ts';
import { DropboxRepositoryService } from './dropbox/service.ts';
import { ProjectRoom } from './room/project-room.ts';

export * from './room/index.ts';
export { ProjectRoom } from './room/project-room.ts';

const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024; // 5 MB ceiling for JSON payloads

export function decodeBase64(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function parseJSONBody<T>(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<T> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    throw APIError.invalidRequest(`Payload exceeds maximum allowed size of ${maxBytes} bytes`);
  }

  const raw = await request.text();
  if (raw.length > maxBytes) {
    throw APIError.invalidRequest(`Payload exceeds maximum allowed size of ${maxBytes} bytes`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw APIError.invalidRequest('Malformed JSON body in request');
  }
}

export interface RouterOptions {
  authOptions?: RouteAuthOptions;
  repo?: CloudRepository;
  dropboxClient?: IDropboxClient;
  dropboxService?: DropboxRepositoryService;
}

export function createRouter(env: Env, options?: RouterOptions) {
  const repo = options?.repo || new CloudRepository(env.DB);
  const authOptions = options?.authOptions;

  let dropboxService = options?.dropboxService;
  if (!dropboxService) {
    const dropboxClient =
      options?.dropboxClient ||
      (env.DROPBOX_CLIENT_ID && env.DROPBOX_CLIENT_SECRET && env.DROPBOX_REFRESH_TOKEN
        ? new DropboxClient({
            clientId: env.DROPBOX_CLIENT_ID,
            clientSecret: env.DROPBOX_CLIENT_SECRET,
            refreshToken: env.DROPBOX_REFRESH_TOKEN,
          })
        : null);

    if (dropboxClient) {
      dropboxService = new DropboxRepositoryService(repo, dropboxClient);
    }
  }

  function requireDropboxService(): DropboxRepositoryService {
    if (!dropboxService) {
      throw APIError.upstreamUnavailable('Dropbox repository service is not configured');
    }
    return dropboxService;
  }

  return async function handleRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      // Health Check
      if (path === '/health' && method === 'GET') {
        return jsonResponse({
          status: 'ok',
          service: 'openpencil-cloud',
          time: new Date().toISOString(),
        });
      }

      // Workspace metadata endpoint
      if ((path === '/api/v1/workspace' || path === '/api/workspace') && method === 'GET') {
        return jsonResponse({
          workspace: {
            id: BIOSCULPTURE_WORKSPACE_ID,
            name: 'Bio Sculpture',
            domain: env.ALLOWED_EMAIL_DOMAIN || 'biosculpture.com',
          },
        });
      }

      // Session lookup: current authenticated Access profile & workspace membership
      if ((path === '/api/session/me' || path === '/api/v1/session/me') && method === 'GET') {
        return await handleGetSessionMe(request, env, repo, authOptions);
      }

      // Session bootstrap: first-login profile creation protected by Cloudflare Turnstile
      if ((path === '/api/session/bootstrap' || path === '/api/v1/session/bootstrap') && method === 'POST') {
        const body = await parseJSONBody<BootstrapRequestBody>(request);
        return await handlePostSessionBootstrap(request, env, repo, body, authOptions);
      }

      // Folders: List active folders
      if ((path === '/api/folders' || path === '/api/v1/folders') && method === 'GET') {
        await authenticateUser(request, env, repo, authOptions);
        const service = requireDropboxService();
        const folders = await service.listFolders();
        return jsonResponse({ folders });
      }

      // Folders: Create folder
      if ((path === '/api/folders' || path === '/api/v1/folders') && method === 'POST') {
        const user = await authenticateUser(request, env, repo, authOptions);
        const body = await parseJSONBody<{ name: string; parentId?: string | null }>(request);
        const service = requireDropboxService();
        const folder = await service.createFolder({
          name: body.name,
          parentId: body.parentId,
          actorId: user.id,
        });
        return jsonResponse({ folder }, 201);
      }

      // Projects: List projects
      if ((path === '/api/projects' || path === '/api/v1/projects') && method === 'GET') {
        await authenticateUser(request, env, repo, authOptions);
        const folderId = url.searchParams.get('folderId');
        const service = requireDropboxService();
        const projects = await service.listProjects(BIOSCULPTURE_WORKSPACE_ID, folderId);
        return jsonResponse({ projects });
      }

      // Projects: Create project
      if ((path === '/api/projects' || path === '/api/v1/projects') && method === 'POST') {
        const user = await authenticateUser(request, env, repo, authOptions);
        const body = await parseJSONBody<{
          name: string;
          folderId: string;
          initialFig?: string;
          initialThumb?: string;
        }>(request);
        const service = requireDropboxService();
        const project = await service.createProject({
          name: body.name,
          folderId: body.folderId,
          actorId: user.id,
          initialFig: body.initialFig ? decodeBase64(body.initialFig) : undefined,
          initialThumb: body.initialThumb ? decodeBase64(body.initialThumb) : undefined,
        });
        return jsonResponse({ project }, 201);
      }

      // Projects: Snapshot GET
      const snapshotMatch = path.match(/^\/api(?:\/v1)?\/projects\/([^/]+)\/snapshot$/);
      if (snapshotMatch && method === 'GET') {
        await authenticateUser(request, env, repo, authOptions);
        const projectId = snapshotMatch[1];
        const service = requireDropboxService();
        const snapshot = await service.getSnapshot(projectId);

        return new Response(snapshot.bytes as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Dropbox-Rev': snapshot.rev,
            ...(snapshot.stateVector ? { 'X-State-Vector': snapshot.stateVector } : {}),
            'Content-Disposition': `attachment; filename="${encodeURIComponent(snapshot.name)}.fig"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      // Projects: Snapshot PUT (optimistic concurrency update)
      if (snapshotMatch && method === 'PUT') {
        const user = await authenticateUser(request, env, repo, authOptions);
        const projectId = snapshotMatch[1];
        const service = requireDropboxService();

        let bytes: Uint8Array;
        let expectedRev: string | null = null;
        let stateVector: string | null = null;
        let retainVersion = false;

        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await parseJSONBody<{
            snapshot: string;
            expectedRev: string;
            stateVector?: string | null;
            retainVersion?: boolean;
          }>(request);
          if (!body.snapshot) throw APIError.invalidRequest('snapshot base64 data is required');
          bytes = decodeBase64(body.snapshot);
          expectedRev = body.expectedRev;
          stateVector = body.stateVector ?? null;
          retainVersion = body.retainVersion ?? false;
        } else {
          expectedRev = request.headers.get('x-expected-rev') || url.searchParams.get('expectedRev');
          stateVector = request.headers.get('x-state-vector') || url.searchParams.get('stateVector');
          retainVersion =
            request.headers.get('x-retain-version') === 'true' ||
            url.searchParams.get('retainVersion') === 'true';
          const buffer = await request.arrayBuffer();
          bytes = new Uint8Array(buffer);
        }

        if (!expectedRev) {
          throw APIError.invalidRequest('Expected revision (X-Expected-Rev) is required for snapshot update');
        }

        const result = await service.updateSnapshot(projectId, {
          bytes,
          expectedRev,
          stateVector,
          retainVersion,
          actorId: user.id,
        });

        return jsonResponse({
          success: true,
          rev: result.rev,
          stateVector: result.stateVector,
        });
      }

      // Projects: Thumbnail GET
      const thumbnailMatch = path.match(/^\/api(?:\/v1)?\/projects\/([^/]+)\/thumbnail$/);
      if (thumbnailMatch && method === 'GET') {
        await authenticateUser(request, env, repo, authOptions);
        const projectId = thumbnailMatch[1];
        const service = requireDropboxService();
        const thumb = await service.getThumbnail(projectId);

        return new Response(thumb.bytes as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': thumb.contentType,
            'Cache-Control': 'public, max-age=300',
          },
        });
      }

      // Projects: Archive POST (admin role required)
      const archiveMatch = path.match(/^\/api(?:\/v1)?\/projects\/([^/]+)\/archive$/);
      if (archiveMatch && method === 'POST') {
        const user = await authenticateUser(request, env, repo, authOptions);
        const projectId = archiveMatch[1];
        const service = requireDropboxService();
        const result = await service.archiveProject(projectId, user.id, user.role);
        return jsonResponse(result);
      }

      // Projects: Collab WebSocket Relay (F-016e)
      const collabMatch = path.match(/^\/api(?:\/v1)?\/projects\/([^/]+)\/collab$/);
      if (collabMatch && method === 'GET') {
        const user = await authenticateUser(request, env, repo, authOptions);
        const projectId = collabMatch[1];

        // 1. Verify project exists in D1 and is active
        const project = await repo.getProjectById(projectId);
        if (!project || project.archivedAt) {
          throw APIError.notFound(`Project not found: ${projectId}`);
        }

        // 2. Verify WebSocket upgrade request
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
          throw APIError.invalidRequest('Expected WebSocket upgrade request (Upgrade: websocket)');
        }

        // 3. Durable Object PROJECT_ROOM binding check
        if (!env.PROJECT_ROOM) {
          throw APIError.upstreamUnavailable('Durable Object PROJECT_ROOM is not bound in environment');
        }

        const doId = env.PROJECT_ROOM.idFromName(projectId);
        const roomStub = env.PROJECT_ROOM.get(doId);

        // 4. Forward request to DO with verified identity headers
        const forwardHeaders = new Headers(request.headers);
        forwardHeaders.set('X-User-Id', user.id);
        forwardHeaders.set('X-User-Email', user.email);
        forwardHeaders.set('X-User-Name', user.displayName);
        forwardHeaders.set('X-User-Role', user.role);
        forwardHeaders.set('X-Project-Id', projectId);

        const forwardRequest = new Request(request.url, {
          method: request.method,
          headers: forwardHeaders,
        });

        return await roomStub.fetch(forwardRequest);
      }

      // Route not found
      throw APIError.notFound(`Endpoint ${method} ${path}`);
    } catch (err: unknown) {
      return createErrorResponse(err);
    }
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const handle = createRouter(env);
    return handle(request);
  },
};
