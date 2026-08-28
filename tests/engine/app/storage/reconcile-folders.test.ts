import { describe, expect, it } from 'bun:test'
import type { StorageDocument } from '@/app/integrations/storage'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'

function localMeta(
  id: string,
  folderId: string | null,
  syncStatus: LocalCanvasMeta['syncStatus'],
  tombstoned = false
): LocalCanvasMeta {
  return {
    id,
    providerId: 'biosculpture-cloud',
    name: `Local ${id}`,
    folderId,
    updatedAt: '2026-08-28T00:00:00.000Z',
    revision: 1,
    syncStatus,
    lastSyncedAt: null,
    lastSyncError: null,
    tombstoned,
    hasFig: true,
    hasThumb: false,
    figSize: 100
  }
}

function remoteDocument(id: string, folderId: string | null = null): StorageDocument {
  return {
    id,
    name: `Remote ${id}`,
    folderId,
    updatedAt: '2026-08-27T00:00:00.000Z',
    metadataAuthoritative: true
  }
}

describe('storage workspace reconciliation with folders', () => {
  it('preserves folderId on both remote and locally pending documents', () => {
    const result = reconcileStorageDocuments(
      [localMeta('local_1', 'fld_local', 'pending')],
      [remoteDocument('remote_1', 'fld_remote'), remoteDocument('remote_root', null)]
    )

    expect(result.documents.length).toBe(3)
    const localDoc = result.documents.find((d) => d.id === 'local_1')
    const remoteDoc = result.documents.find((d) => d.id === 'remote_1')
    const rootDoc = result.documents.find((d) => d.id === 'remote_root')

    expect(localDoc?.folderId).toBe('fld_local')
    expect(remoteDoc?.folderId).toBe('fld_remote')
    expect(rootDoc?.folderId).toBeNull()
  })

  it('correctly reports remoteDocumentsToSeed with folderId preserved', () => {
    const result = reconcileStorageDocuments(
      [],
      [remoteDocument('remote_1', 'fld_assets')]
    )

    expect(result.remoteDocumentsToSeed.length).toBe(1)
    expect(result.remoteDocumentsToSeed[0]?.id).toBe('remote_1')
    expect(result.remoteDocumentsToSeed[0]?.folderId).toBe('fld_assets')
  })
})
