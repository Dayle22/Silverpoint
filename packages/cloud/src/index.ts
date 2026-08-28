// Cloudflare Worker API entry point for @open-pencil/cloud

import { type Env, BIOSCULPTURE_WORKSPACE_ID } from './types.ts';
import { APIError, createErrorResponse, jsonResponse } from './errors.ts';
import { CloudRepository } from './db/repository.ts';

const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024; // 5 MB ceiling for JSON payloads

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

export function createRouter(env: Env) {
  const _repo = new CloudRepository(env.DB);

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
      if (path === '/api/v1/workspace' && method === 'GET') {
        return jsonResponse({
          workspace: {
            id: BIOSCULPTURE_WORKSPACE_ID,
            name: 'Bio Sculpture',
            domain: env.ALLOWED_EMAIL_DOMAIN || 'biosculpture.com',
          },
        });
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
