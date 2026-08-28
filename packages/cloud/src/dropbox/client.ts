// Dropbox API v2 Client Boundary with OAuth refresh and optimistic concurrency

import { APIError } from '../errors.ts';
import type {
  DropboxConfig,
  DropboxFolderMetadata,
  DropboxFileMetadata,
  DropboxMetadata,
  DropboxListFolderResult,
  DropboxEntry,
  DropboxUploadMode,
  DropboxDownloadResult,
} from './types.ts';

const DEFAULT_TOKEN_URL = 'https://api.dropbox.com/oauth2/token';
const DEFAULT_API_BASE_URL = 'https://api.dropboxapi.com/2';
const DEFAULT_CONTENT_BASE_URL = 'https://content.dropboxapi.com/2';

export interface IDropboxClient {
  createFolder(path: string): Promise<DropboxFolderMetadata>;
  getMetadata(pathOrId: string): Promise<DropboxMetadata | null>;
  listFolder(path: string, options?: { recursive?: boolean; limit?: number; cursor?: string }): Promise<DropboxListFolderResult>;
  listAllFolderEntries(path: string, options?: { recursive?: boolean; limit?: number }): Promise<DropboxEntry[]>;
  uploadFile(
    path: string,
    content: Uint8Array | ArrayBuffer | string,
    mode?: DropboxUploadMode
  ): Promise<DropboxFileMetadata>;
  downloadFile(pathOrId: string): Promise<DropboxDownloadResult>;
  deletePath(pathOrId: string): Promise<void>;
}

export class DropboxClient implements IDropboxClient {
  private readonly config: DropboxConfig;
  private readonly fetchFn: typeof fetch;
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: DropboxConfig) {
    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      throw APIError.internal('Dropbox credentials (clientId, clientSecret, refreshToken) are required');
    }
    this.config = config;
    this.fetchFn = config.fetchFn || fetch;
  }

  public getAccessTokenForTesting(): string | null {
    return this.cachedAccessToken;
  }

  public clearCachedToken(): void {
    this.cachedAccessToken = null;
    this.tokenExpiresAt = 0;
  }

  private async getValidAccessToken(): Promise<string> {
    const now = Date.now();
    // Use a 60 second safety buffer
    if (this.cachedAccessToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedAccessToken;
    }

    const tokenUrl = this.config.tokenUrl || DEFAULT_TOKEN_URL;
    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    let res: Response;
    try {
      res = await this.fetchFn(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: bodyParams.toString(),
      });
    } catch {
      throw APIError.upstreamUnavailable('Dropbox OAuth service');
    }

    if (!res.ok) {
      if (res.status === 400 || res.status === 401) {
        throw APIError.unauthenticated('Dropbox OAuth token refresh failed: invalid credentials');
      }
      throw APIError.upstreamUnavailable('Dropbox OAuth service');
    }

    try {
      const data = (await res.json()) as { access_token: string; expires_in?: number };
      if (!data.access_token) {
        throw new Error('Missing access_token in refresh response');
      }
      this.cachedAccessToken = data.access_token;
      const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 14400; // 4 hours default
      this.tokenExpiresAt = now + expiresInSec * 1000;
      return this.cachedAccessToken;
    } catch (err: unknown) {
      if (err instanceof APIError) throw err;
      throw APIError.upstreamUnavailable('Dropbox OAuth service returned invalid response');
    }
  }

  private parseRetryAfter(res: Response): number {
    const retryHeader = res.headers.get('retry-after') || res.headers.get('Retry-After');
    if (!retryHeader) return 50; // default 50ms in testing
    const parsed = Number.parseInt(retryHeader, 10);
    if (Number.isNaN(parsed) || parsed < 0) return 50;
    return Math.min(parsed * 1000, 5000); // capped at 5s
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private handleDropboxErrorResponse(status: number, errorText: string): never {
    let errorSummary = '';
    try {
      const parsed = JSON.parse(errorText) as { error_summary?: string; error?: Record<string, unknown> };
      errorSummary = parsed.error_summary || '';
    } catch {
      // Non-JSON error
    }

    if (status === 409) {
      if (errorSummary.includes('conflict') || errorSummary.includes('path/conflict')) {
        throw APIError.conflict('Dropbox revision conflict: document was modified by another concurrent write');
      }
      if (errorSummary.includes('not_found') || errorSummary.includes('path/not_found')) {
        throw APIError.notFound('Dropbox file or folder not found');
      }
      throw APIError.conflict(`Dropbox request conflict: ${errorSummary || 'Resource conflict'}`);
    }

    if (status === 404) {
      throw APIError.notFound('Dropbox resource not found');
    }

    if (status === 401) {
      throw APIError.unauthenticated('Dropbox authentication failed');
    }

    if (status === 403) {
      throw APIError.forbidden('Dropbox access forbidden');
    }

    if (status === 429) {
      throw APIError.upstreamUnavailable('Dropbox rate limit exceeded');
    }

    if (status >= 500) {
      throw APIError.upstreamUnavailable('Dropbox service');
    }

    throw APIError.internal('Unexpected error during Dropbox operation');
  }

  private async executeRpcRequest<T>(
    endpoint: string,
    body: Record<string, unknown>,
    retries = 2
  ): Promise<T> {
    const apiBase = this.config.apiBaseUrl || DEFAULT_API_BASE_URL;
    const url = `${apiBase}/${endpoint.replace(/^\/+/, '')}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const token = await this.getValidAccessToken();
        const res = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          return (await res.json()) as T;
        }

        if (res.status === 401 && attempt < retries) {
          this.clearCachedToken();
          continue;
        }

        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const delay = this.parseRetryAfter(res);
          await this.sleep(delay);
          continue;
        }

        const errorText = await res.text();
        this.handleDropboxErrorResponse(res.status, errorText);
      } catch (err: unknown) {
        lastError = err;
        if (err instanceof APIError) {
          throw err;
        }
        if (attempt < retries) {
          await this.sleep(50 * (attempt + 1));
          continue;
        }
      }
    }

    if (lastError instanceof APIError) throw lastError;
    throw APIError.upstreamUnavailable('Dropbox service unreachable');
  }

  async createFolder(path: string): Promise<DropboxFolderMetadata> {
    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
    const data = await this.executeRpcRequest<{ metadata: DropboxFolderMetadata }>(
      'files/create_folder_v2',
      {
        path: sanitizedPath,
        autorename: false,
      }
    );
    return data.metadata;
  }

  async getMetadata(pathOrId: string): Promise<DropboxMetadata | null> {
    try {
      const data = await this.executeRpcRequest<DropboxMetadata>('files/get_metadata', {
        path: pathOrId,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      });
      return data;
    } catch (err: unknown) {
      if (err instanceof APIError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async listFolder(
    path: string,
    options?: { recursive?: boolean; limit?: number; cursor?: string }
  ): Promise<DropboxListFolderResult> {
    if (options?.cursor) {
      return await this.executeRpcRequest<DropboxListFolderResult>('files/list_folder/continue', {
        cursor: options.cursor,
      });
    }

    const sanitizedPath = path === '' || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
    return await this.executeRpcRequest<DropboxListFolderResult>('files/list_folder', {
      path: sanitizedPath,
      recursive: options?.recursive ?? false,
      limit: options?.limit,
    });
  }

  async listAllFolderEntries(
    path: string,
    options?: { recursive?: boolean; limit?: number }
  ): Promise<DropboxEntry[]> {
    let result = await this.listFolder(path, {
      recursive: options?.recursive,
      limit: options?.limit,
    });

    const entries: DropboxEntry[] = [...result.entries];

    // Bounded pagination: protect against infinite loops
    let pageCount = 0;
    while (result.has_more && pageCount < 50) {
      pageCount++;
      result = await this.listFolder(path, { cursor: result.cursor });
      entries.push(...result.entries);
    }

    return entries;
  }

  async uploadFile(
    path: string,
    content: Uint8Array | ArrayBuffer | string,
    mode: DropboxUploadMode = { '.tag': 'add' }
  ): Promise<DropboxFileMetadata> {
    const contentBase = this.config.contentBaseUrl || DEFAULT_CONTENT_BASE_URL;
    const url = `${contentBase}/files/upload`;
    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;

    const apiArg = JSON.stringify({
      path: sanitizedPath,
      mode,
      autorename: false,
      mute: false,
    });

    const payload =
      typeof content === 'string'
        ? new TextEncoder().encode(content)
        : content instanceof Uint8Array
          ? content
          : new Uint8Array(content);

    const retries = 2;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const token = await this.getValidAccessToken();
        const res = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Dropbox-API-Arg': apiArg,
            'Content-Type': 'application/octet-stream',
          },
          body: payload as BodyInit,
        });

        if (res.ok) {
          return (await res.json()) as DropboxFileMetadata;
        }

        if (res.status === 401 && attempt < retries) {
          this.clearCachedToken();
          continue;
        }

        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const delay = this.parseRetryAfter(res);
          await this.sleep(delay);
          continue;
        }

        const errorText = await res.text();
        this.handleDropboxErrorResponse(res.status, errorText);
      } catch (err: unknown) {
        if (err instanceof APIError) throw err;
        if (attempt < retries) {
          await this.sleep(50 * (attempt + 1));
          continue;
        }
        throw APIError.upstreamUnavailable('Dropbox upload service unreachable');
      }
    }

    throw APIError.upstreamUnavailable('Dropbox upload service failed');
  }

  async downloadFile(pathOrId: string): Promise<DropboxDownloadResult> {
    const contentBase = this.config.contentBaseUrl || DEFAULT_CONTENT_BASE_URL;
    const url = `${contentBase}/files/download`;

    const apiArg = JSON.stringify({
      path: pathOrId,
    });

    const retries = 2;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const token = await this.getValidAccessToken();
        const res = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Dropbox-API-Arg': apiArg,
          },
        });

        if (res.ok) {
          const resultHeader = res.headers.get('dropbox-api-result') || res.headers.get('Dropbox-API-Result');
          if (!resultHeader) {
            throw APIError.internal('Missing Dropbox-API-Result header in download response');
          }
          const metadata = JSON.parse(resultHeader) as DropboxFileMetadata;
          const arrayBuffer = await res.arrayBuffer();
          return {
            metadata,
            content: new Uint8Array(arrayBuffer),
          };
        }

        if (res.status === 401 && attempt < retries) {
          this.clearCachedToken();
          continue;
        }

        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const delay = this.parseRetryAfter(res);
          await this.sleep(delay);
          continue;
        }

        const errorText = await res.text();
        this.handleDropboxErrorResponse(res.status, errorText);
      } catch (err: unknown) {
        if (err instanceof APIError) throw err;
        if (attempt < retries) {
          await this.sleep(50 * (attempt + 1));
          continue;
        }
        throw APIError.upstreamUnavailable('Dropbox download service unreachable');
      }
    }

    throw APIError.upstreamUnavailable('Dropbox download service failed');
  }

  async deletePath(pathOrId: string): Promise<void> {
    await this.executeRpcRequest<{ metadata: DropboxMetadata }>('files/delete_v2', {
      path: pathOrId,
    });
  }
}
