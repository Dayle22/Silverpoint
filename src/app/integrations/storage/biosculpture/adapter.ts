import type {
  StorageAdapter,
  StorageConnectionResult,
  StorageDocument,
  StorageDocumentMetadata,
  StorageFolder,
  StorageTransferProgress,
  StorageUsage
} from '../types'

export interface BioSculptureAdapterOptions {
  apiBase?: string
  fetchImpl?: typeof fetch
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}

export class BioSculptureStorageAdapter implements StorageAdapter {
  readonly #apiBase: string
  readonly #fetch: typeof fetch

  constructor(options?: BioSculptureAdapterOptions) {
    this.#apiBase = (options?.apiBase ?? '').replace(/\/+$/, '')
    this.#fetch = options?.fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  }

  async testConnection(): Promise<StorageConnectionResult> {
    try {
      const response = await this.#fetch(`${this.#apiBase}/api/session/me`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { ok: false, message: 'Unauthenticated or forbidden access to Bio Sculpture Cloud' }
        }
        return { ok: false, message: `Server error: ${response.status}` }
      }
      return { ok: true, message: 'Connected to Bio Sculpture Cloud' }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to reach Bio Sculpture Cloud'
      }
    }
  }

  async listFolders(): Promise<StorageFolder[]> {
    const response = await this.#fetch(`${this.#apiBase}/api/folders`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) {
      throw new Error(`Failed to list folders: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as { folders?: StorageFolder[] }
    return data.folders ?? []
  }

  async createFolder(name: string, parentId?: string | null): Promise<StorageFolder> {
    const response = await this.#fetch(`${this.#apiBase}/api/folders`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ name, parentId: parentId ?? null })
    })
    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as { folder: StorageFolder }
    return data.folder
  }

  async listDocuments(folderId?: string): Promise<StorageDocument[]> {
    const url = new URL(`${this.#apiBase}/api/projects`, globalThis.location.origin)
    if (folderId) {
      url.searchParams.set('folderId', folderId)
    }
    const response = await this.#fetch(url.toString(), {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) {
      throw new Error(`Failed to list projects: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as {
      projects?: Array<{
        id: string
        folderId?: string | null
        name: string
        updatedAt: string
        thumbnailUrl?: string | null
      }>
    }
    const projects = data.projects ?? []
    return projects.map((p) => ({
      id: p.id,
      folderId: p.folderId ?? null,
      name: p.name,
      updatedAt: p.updatedAt,
      thumbnailURL: p.thumbnailUrl ?? null,
      metadataAuthoritative: true
    }))
  }

  async createProject(
    name: string,
    folderId: string,
    initialFig?: Uint8Array,
    initialThumb?: Uint8Array
  ): Promise<StorageDocument> {
    const response = await this.#fetch(`${this.#apiBase}/api/projects`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        name,
        folderId,
        initialFig: initialFig ? bytesToBase64(initialFig) : undefined,
        initialThumb: initialThumb ? bytesToBase64(initialThumb) : undefined
      })
    })
    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as {
      project: {
        id: string
        folderId: string
        name: string
        updatedAt: string
        thumbnailUrl?: string | null
      }
    }
    return {
      id: data.project.id,
      folderId: data.project.folderId,
      name: data.project.name,
      updatedAt: data.project.updatedAt,
      thumbnailURL: data.project.thumbnailUrl ?? null,
      metadataAuthoritative: true
    }
  }

  async getDocument(
    id: string,
    onProgress?: (progress: StorageTransferProgress) => void
  ): Promise<Uint8Array> {
    const response = await this.#fetch(`${this.#apiBase}/api/projects/${id}/snapshot`, {
      method: 'GET',
      credentials: 'same-origin'
    })
    if (!response.ok) {
      throw new Error(`Failed to get project snapshot: ${response.status} ${response.statusText}`)
    }
    const totalBytes = Number(response.headers.get('content-length')) || null
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    onProgress?.({
      transferredBytes: bytes.byteLength,
      totalBytes: totalBytes ?? bytes.byteLength
    })
    return bytes
  }

  async putDocument(
    id: string,
    bytes: Uint8Array,
    _metadata: StorageDocumentMetadata,
    onProgress?: (progress: StorageTransferProgress) => void
  ): Promise<void> {
    const response = await this.#fetch(`${this.#apiBase}/api/projects/${id}/snapshot`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: bytes as BodyInit
    })
    if (!response.ok) {
      if (response.status === 409) {
        throw new Error(`Conflict: remote project snapshot revision has changed (409)`)
      }
      throw new Error(`Failed to put project snapshot: ${response.status} ${response.statusText}`)
    }
    onProgress?.({ transferredBytes: bytes.byteLength, totalBytes: bytes.byteLength })
  }

  async getSnapshotWithRevision(
    id: string
  ): Promise<{ bytes: Uint8Array; rev: string; stateVector?: string | null; name?: string }> {
    const response = await this.#fetch(`${this.#apiBase}/api/projects/${id}/snapshot`, {
      method: 'GET',
      credentials: 'same-origin'
    })
    if (!response.ok) {
      throw new Error(`Failed to get project snapshot: ${response.status} ${response.statusText}`)
    }
    const rev = response.headers.get('X-Dropbox-Rev') || ''
    const stateVector = response.headers.get('X-State-Vector') || null
    const buffer = await response.arrayBuffer()
    return {
      bytes: new Uint8Array(buffer),
      rev,
      stateVector
    }
  }

  async putSnapshotWithRevision(
    id: string,
    bytes: Uint8Array,
    expectedRev: string,
    stateVector?: string | null,
    retainVersion?: boolean
  ): Promise<{ rev: string; stateVector?: string | null }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'X-Expected-Rev': expectedRev
    }
    if (stateVector) headers['X-State-Vector'] = stateVector
    if (retainVersion) headers['X-Retain-Version'] = 'true'

    const response = await this.#fetch(`${this.#apiBase}/api/projects/${id}/snapshot`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers,
      body: bytes as BodyInit
    })
    if (!response.ok) {
      if (response.status === 409) {
        throw new Error(`Conflict: remote project snapshot revision mismatch (409)`)
      }
      throw new Error(`Failed to update project snapshot: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as { rev: string; stateVector?: string | null }
    return {
      rev: data.rev,
      stateVector: data.stateVector
    }
  }

  async getThumbnail(id: string): Promise<Uint8Array | null> {
    const response = await this.#fetch(`${this.#apiBase}/api/projects/${id}/thumbnail`, {
      method: 'GET',
      credentials: 'same-origin'
    })
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Failed to get project thumbnail: ${response.status}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }

  async deleteDocument(id: string): Promise<void> {
    await this.archiveProject(id)
  }

  async archiveProject(id: string): Promise<void> {
    const response = await this.#fetch(`${this.#apiBase}/api/projects/${id}/archive`, {
      method: 'POST',
      credentials: 'same-origin'
    })
    if (!response.ok) {
      throw new Error(`Failed to archive project: ${response.status} ${response.statusText}`)
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

export function createBioSculptureStorageAdapter(options?: BioSculptureAdapterOptions): StorageAdapter {
  return new BioSculptureStorageAdapter(options)
}
