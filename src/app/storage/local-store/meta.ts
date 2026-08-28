import type {
  LocalCanvasIndexInput,
  LocalCanvasMeta,
  LocalCanvasWriteInput
} from '@/app/storage/local-store/types'

/** Newest-first, tombstones hidden unless asked for. */
export function sortAndFilterMetas(
  all: LocalCanvasMeta[],
  includeTombstones: boolean
): LocalCanvasMeta[] {
  const filtered = includeTombstones ? all : all.filter((m) => !m.tombstoned)
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function resolveFolderId(input: LocalCanvasWriteInput, existing: LocalCanvasMeta | null): string | null {
  if (input.folderId !== undefined) return input.folderId
  return existing?.folderId ?? null
}

function resolveRevision(input: LocalCanvasWriteInput, existing: LocalCanvasMeta | null): number {
  if (input.revision !== undefined) return input.revision
  return existing ? existing.revision + 1 : 1
}

function resolveRemoteRev(input: LocalCanvasWriteInput, existing: LocalCanvasMeta | null): string | null {
  if (input.remoteRev !== undefined) return input.remoteRev
  return existing?.remoteRev ?? null
}

function resolveStateVector(input: LocalCanvasWriteInput, existing: LocalCanvasMeta | null): string | null {
  if (input.stateVector !== undefined) return input.stateVector
  return existing?.stateVector ?? null
}

/** Meta row for a full canvas write (fig bytes present). */
export function buildWriteMeta(
  input: LocalCanvasWriteInput,
  existing: LocalCanvasMeta | null,
  hasThumb: boolean
): LocalCanvasMeta {
  const isSynced = input.syncStatus === 'synced'
  const syncError = isSynced ? null : (existing ? existing.lastSyncError : null)
  return {
    id: input.id,
    providerId: input.providerId,
    name: input.name,
    folderId: resolveFolderId(input, existing),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    revision: resolveRevision(input, existing),
    remoteRev: resolveRemoteRev(input, existing),
    stateVector: resolveStateVector(input, existing),
    syncStatus: input.syncStatus ?? 'pending',
    lastSyncedAt: existing ? existing.lastSyncedAt : null,
    lastSyncError: syncError,
    // A deleted canvas stays deleted — an in-flight autosave must not resurrect it
    tombstoned: existing ? existing.tombstoned : false,
    hasFig: true,
    hasThumb,
    figSize: input.figBytes.byteLength,
    lastOpenedAt: existing ? existing.lastOpenedAt : undefined
  }
}

/** Meta row for an index-only upsert (remote canvas, no local fig). */
export function buildIndexMeta(
  input: LocalCanvasIndexInput,
  existing: LocalCanvasMeta | null
): LocalCanvasMeta {
  return {
    id: input.id,
    providerId: input.providerId,
    name: input.name,
    folderId: input.folderId !== undefined ? input.folderId : (existing?.folderId ?? null),
    updatedAt: input.updatedAt,
    revision: input.revision ?? existing?.revision ?? 1,
    remoteRev: input.remoteRev !== undefined ? input.remoteRev : (existing?.remoteRev ?? null),
    stateVector:
      input.stateVector !== undefined ? input.stateVector : (existing?.stateVector ?? null),
    syncStatus: input.syncStatus,
    lastSyncedAt: input.lastSyncedAt,
    lastSyncError: input.lastSyncError,
    tombstoned: false,
    hasFig: input.hasFig ?? existing?.hasFig ?? false,
    hasThumb: input.hasThumb ?? existing?.hasThumb ?? false
  }
}
