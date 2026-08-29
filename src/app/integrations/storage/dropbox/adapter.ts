import { extractFigThumbnailFromReader } from '@open-pencil/fig'
import type {
  StorageAdapter,
  StorageConnectionResult,
  StorageDocument,
  StorageDocumentMetadata,
  StorageFolder,
  StorageProviderRuntime,
  StorageTransferProgress,
  StorageUsage
} from '../types'
import type { DropboxListFolderResult } from './types'

const APP_KEY_FIELD = 'app-key'
const APP_SECRET_FIELD = 'app-secret'
const REFRESH_TOKEN_FIELD = 'refresh-token'

interface ResolvedDropboxCredentials {
  appKey: string
  appSecret: string
  refreshToken: string
}

async function resolveCredentials(runtime: StorageProviderRuntime): Promise<ResolvedDropboxCredentials> {
  const [appKey, appSecret, refreshToken] = await Promise.all([
    runtime.resolveCredential(APP_KEY_FIELD),
    runtime.resolveCredential(APP_SECRET_FIELD),
    runtime.resolveCredential(REFRESH_TOKEN_FIELD)
  ])

  if (!appKey || !appSecret || !refreshToken) {
    throw new Error('Dropbox credentials (App Key, App Secret, Refresh Token) are required')
  }

  return { appKey, appSecret, refreshToken }
}

export class DirectDropboxStorageAdapter implements StorageAdapter {
  readonly #runtime: StorageProviderRuntime
  #cachedAccessToken: string | null = null
  #tokenExpiresAt = 0

  constructor(runtime: StorageProviderRuntime) {
    this.#runtime = runtime
  }

  async #getValidAccessToken(): Promise<string> {
    const now = Date.now()
    if (this.#cachedAccessToken && this.#tokenExpiresAt > now + 60000) {
      return this.#cachedAccessToken
    }

    const { appKey, appSecret, refreshToken } = await resolveCredentials(this.#runtime)
    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret
    })

    const res = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: bodyParams.toString()
    })

    if (!res.ok) {
      this.#cachedAccessToken = null
      throw new Error(`Dropbox authorization failed (${res.status}). Check your App Key, App Secret, and Refresh Token.`)
    }

    const data = (await res.json()) as { access_token: string; expires_in?: number }
    this.#cachedAccessToken = data.access_token
    const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 14400
    this.#tokenExpiresAt = now + expiresInSec * 1000
    return this.#cachedAccessToken
  }

  async #rpc<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.#getValidAccessToken()
    const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Dropbox API error (${res.status}): ${errorText}`)
    }

    return (await res.json()) as T
  }

  async testConnection(): Promise<StorageConnectionResult> {
    try {
      await this.#getValidAccessToken()
      const list = await this.#rpc<DropboxListFolderResult>('files/list_folder', {
        path: '',
        recursive: false,
        limit: 10
      })
      return {
        ok: true,
        message: `Connected to Dropbox App Folder. Found ${list.entries.length} items.`
      }
    } catch (err: unknown) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err)
      }
    }
  }

  async listFolders(): Promise<StorageFolder[]> {
    try {
      const list = await this.#rpc<DropboxListFolderResult>('files/list_folder', {
        path: '',
        recursive: true
      })
      const folders: StorageFolder[] = []
      for (const entry of list.entries) {
        if (entry['.tag'] === 'folder') {
          folders.push({
            id: entry.id,
            name: entry.name,
            parentId: null
          })
        }
      }
      return folders
    } catch {
      return []
    }
  }

  async listDocuments(): Promise<StorageDocument[]> {
    const list = await this.#rpc<DropboxListFolderResult>('files/list_folder', {
      path: '',
      recursive: true
    })

    const documents: StorageDocument[] = []
    for (const entry of list.entries) {
      if (entry['.tag'] === 'file' && entry.name.endsWith('.fig')) {
        const displayName = entry.name.replace(/\.fig$/i, '')
        documents.push({
          id: entry.id,
          name: displayName,
          updatedAt: entry.server_modified || new Date().toISOString(),
          metadataAuthoritative: true
        })
      }
    }

    return documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getDocument(
    id: string,
    onProgress?: (progress: StorageTransferProgress) => void
  ): Promise<Uint8Array> {
    const token = await this.#getValidAccessToken()
    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: id })
      }
    })

    if (!res.ok) {
      throw new Error(`Failed to download file from Dropbox (${res.status})`)
    }

    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    onProgress?.({ transferredBytes: bytes.byteLength, totalBytes: bytes.byteLength })
    return bytes
  }

  async putDocument(
    id: string,
    bytes: Uint8Array,
    metadata: StorageDocumentMetadata,
    onProgress?: (progress: StorageTransferProgress) => void
  ): Promise<void> {
    const token = await this.#getValidAccessToken()
    const filename = metadata.name.endsWith('.fig') ? metadata.name : `${metadata.name}.fig`
    const path = id.startsWith('id:') ? id : `/${filename}`

    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: { '.tag': 'overwrite' },
          autorename: false,
          mute: false
        }),
        'Content-Type': 'application/octet-stream'
      },
      body: bytes as BodyInit
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Failed to upload to Dropbox: ${errText}`)
    }

    onProgress?.({ transferredBytes: bytes.byteLength, totalBytes: bytes.byteLength })
  }

  async deleteDocument(id: string): Promise<void> {
    await this.#rpc('files/delete_v2', { path: id })
  }

  async getThumbnail(id: string): Promise<Uint8Array | null> {
    try {
      const bytes = await this.getDocument(id)
      return extractFigThumbnailFromReader({
        size: bytes.byteLength,
        async read(start: number, endExclusive: number) {
          return bytes.slice(start, endExclusive)
        }
      })
    } catch {
      return null
    }
  }

  async getUsage(): Promise<StorageUsage> {
    return {
      bytesUsed: 0,
      objectCount: 0,
      documentCount: 0
    }
  }
}

export function createDirectDropboxStorageAdapter(runtime: StorageProviderRuntime): StorageAdapter {
  return new DirectDropboxStorageAdapter(runtime)
}
