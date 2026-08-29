import { describe, expect, it } from 'bun:test'
import {
  BioSculptureStorageAdapter,
  createBioSculptureStorageAdapter
} from '@/app/integrations/storage/biosculpture/adapter'
describe('BioSculptureStorageAdapter', () => {
  it('instantiates adapter directly with options', () => {
    const adapter = createBioSculptureStorageAdapter()
    expect(adapter).toBeDefined()
  })

  it('tests connection against /api/session/me', async () => {
    const mockFetch: typeof fetch = async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/session/me')) {
        return new Response(JSON.stringify({ user: { id: 'usr_1', email: 'test@biosculpture.com' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response('Not found', { status: 404 })
    }

    const adapter = createBioSculptureStorageAdapter({ fetchImpl: mockFetch })
    const result = await adapter.testConnection()
    expect(result.ok).toBe(true)
    expect(result.message).toContain('Connected to Bio Sculpture Cloud')
  })

  it('lists folders from /api/folders', async () => {
    const mockFetch: typeof fetch = async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/folders')) {
        return new Response(
          JSON.stringify({
            folders: [
              { id: 'fld_1', parentId: null, name: 'Brand Assets' },
              { id: 'fld_2', parentId: 'fld_1', name: 'Autumn 2026' }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('Not found', { status: 404 })
    }

    const adapter = new BioSculptureStorageAdapter({ fetchImpl: mockFetch })
    const folders = await adapter.listFolders()
    expect(folders.length).toBe(2)
    expect(folders[0]?.name).toBe('Brand Assets')
    expect(folders[1]?.parentId).toBe('fld_1')
  })

  it('creates folder via POST /api/folders', async () => {
    let capturedBody: unknown = null
    const mockFetch: typeof fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/folders') && init?.method === 'POST') {
        capturedBody = JSON.parse(String(init.body))
        return new Response(
          JSON.stringify({
            folder: { id: 'fld_new', parentId: 'fld_1', name: 'Winter Collection' }
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('Not found', { status: 404 })
    }

    const adapter = new BioSculptureStorageAdapter({ fetchImpl: mockFetch })
    const folder = await adapter.createFolder('Winter Collection', 'fld_1')
    expect(folder.id).toBe('fld_new')
    expect(capturedBody).toEqual({ name: 'Winter Collection', parentId: 'fld_1' })
  })

  it('lists projects with metadata from /api/projects', async () => {
    const mockFetch: typeof fetch = async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/projects')) {
        return new Response(
          JSON.stringify({
            projects: [
              {
                id: 'prj_1',
                folderId: 'fld_1',
                name: 'Poster Design',
                updatedAt: '2026-08-28T12:00:00.000Z'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('Not found', { status: 404 })
    }

    const adapter = new BioSculptureStorageAdapter({ fetchImpl: mockFetch })
    const docs = await adapter.listDocuments('fld_1')
    expect(docs.length).toBe(1)
    expect(docs[0]?.id).toBe('prj_1')
    expect(docs[0]?.folderId).toBe('fld_1')
    expect(docs[0]?.name).toBe('Poster Design')
    expect(docs[0]?.metadataAuthoritative).toBe(true)
  })

  it('gets snapshot and extracts revision header', async () => {
    const payload = new Uint8Array([1, 2, 3, 4])
    const mockFetch: typeof fetch = async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/projects/prj_1/snapshot')) {
        return new Response(payload, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Dropbox-Rev': 'rev_abc123',
            'X-State-Vector': 'sv_xyz'
          }
        })
      }
      return new Response('Not found', { status: 404 })
    }

    const adapter = new BioSculptureStorageAdapter({ fetchImpl: mockFetch })
    const snapshot = await adapter.getSnapshotWithRevision('prj_1')
    expect(snapshot.bytes).toEqual(payload)
    expect(snapshot.rev).toBe('rev_abc123')
    expect(snapshot.stateVector).toBe('sv_xyz')
  })

  it('updates snapshot with expected revision and handles 409 conflict', async () => {
    const mockFetch: typeof fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/projects/prj_1/snapshot') && init?.method === 'PUT') {
        const headers = init.headers as Record<string, string>
        if (headers['X-Expected-Rev'] !== 'rev_current') {
          return new Response(
            JSON.stringify({
              error: { code: 'conflict', message: 'Revision conflict' }
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        }
        return new Response(JSON.stringify({ rev: 'rev_next', stateVector: 'sv_2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response('Not found', { status: 404 })
    }

    const adapter = new BioSculptureStorageAdapter({ fetchImpl: mockFetch })
    const ok = await adapter.putSnapshotWithRevision('prj_1', new Uint8Array([5, 6]), 'rev_current')
    expect(ok.rev).toBe('rev_next')

    expect(
      adapter.putSnapshotWithRevision('prj_1', new Uint8Array([5, 6]), 'rev_stale')
    ).rejects.toThrow('Conflict')
  })

  it('archives project through POST /api/projects/:id/archive', async () => {
    let archivedId: string | null = null
    const mockFetch: typeof fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/projects/prj_1/archive') && init?.method === 'POST') {
        archivedId = 'prj_1'
        return new Response(JSON.stringify({ success: true, archived: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response('Not found', { status: 404 })
    }

    const adapter = new BioSculptureStorageAdapter({ fetchImpl: mockFetch })
    await adapter.archiveProject('prj_1')
    expect(archivedId).toBe('prj_1')
  })
})
