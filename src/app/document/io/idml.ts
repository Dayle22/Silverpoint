import { ref } from 'vue'

import type { Editor, EditorState } from '@open-pencil/core/editor'
import { restoreSubtree, snapshotSubtree } from '@open-pencil/core/editor/clipboard/subtree-history'
import {
  importIdml,
  readIdmlSummary,
  type IdmlImportDiagnostic,
  type IdmlPageSummary
} from '@open-pencil/core/io/formats/idml'
import type { SceneNode } from '@open-pencil/scene-graph'
import { dialogMessages } from '@open-pencil/vue'

import { toast } from '@/app/shell/ui'

export interface IDMLImportSession {
  file: File
  data: Uint8Array
  handle?: FileSystemFileHandle
  path?: string
  pages: IdmlPageSummary[]
  diagnostics: IdmlImportDiagnostic[]
  editor: Editor
  state: EditorState & { documentName: string; loading: boolean }
  isUntouchedTab: boolean
  setDocumentSource: (
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) => void
  fitCurrentPageToViewport: () => Promise<void>
  onDiscardTab?: () => void
}

export const idmlImportOpen = ref(false)
export const idmlImportLoading = ref(false)
export const currentIdmlSession = ref<IDMLImportSession | null>(null)

type OpenIDMLFileOptions = {
  editor: Editor
  state: EditorState & { documentName: string; loading: boolean }
  setDocumentSource: (
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) => void
  fitCurrentPageToViewport: () => Promise<void>
  isUntouchedTab?: boolean
  onDiscardTab?: () => void
}

export function createIDMLOpenActions({
  editor,
  state,
  setDocumentSource,
  fitCurrentPageToViewport,
  isUntouchedTab = false,
  onDiscardTab
}: OpenIDMLFileOptions) {
  async function openIDMLFile(
    file: File,
    options: { handle?: FileSystemFileHandle; path?: string } = {}
  ): Promise<void> {
    try {
      state.loading = true
      const data = new Uint8Array(await file.arrayBuffer())
      const { pages, diagnostics } = await readIdmlSummary(data)

      const fatalError = diagnostics.find((d) => d.severity === 'error')
      if (fatalError || pages.length === 0) {
        const message =
          fatalError?.message || dialogMessages.get().openFileFailed({ detail: 'No pages in IDML' })
        toast.error(message)
        if (onDiscardTab) onDiscardTab()
        return
      }

      currentIdmlSession.value = {
        file,
        data,
        handle: options.handle,
        path: options.path,
        pages,
        diagnostics,
        editor,
        state,
        isUntouchedTab,
        setDocumentSource,
        fitCurrentPageToViewport,
        onDiscardTab
      }
      idmlImportOpen.value = true
    } catch (e) {
      console.error('Failed to parse IDML summary:', e)
      const detail = e instanceof Error ? e.message : String(e)
      toast.error(dialogMessages.get().openFileFailed({ detail }))
      if (onDiscardTab) onDiscardTab()
    } finally {
      state.loading = false
    }
  }

  return { openIDMLFile }
}

export async function confirmIdmlImport(): Promise<void> {
  const session = currentIdmlSession.value
  if (!session) return

  try {
    idmlImportLoading.value = true
    const { graph: importedGraph, diagnostics } = await importIdml(session.data, {
      fileName: session.file.name
    })

    const fatalError = diagnostics.find((d) => d.severity === 'error')
    if (fatalError) {
      toast.error(fatalError.message)
      return
    }

    const { editor, state } = session
    const targetGraph = editor.graph

    // Copy images into target graph
    for (const [hash, bytes] of importedGraph.images) {
      targetGraph.images.set(hash, bytes)
    }

    const targetPageId = state.currentPageId
    const importedPage = importedGraph.getPages()[0]
    const importedChildren = importedGraph.getChildren(importedPage.id)

    if (importedChildren.length > 0) {
      const snapshots = new Map<string, SceneNode>()
      for (const child of importedChildren) {
        const subtree = snapshotSubtree(importedGraph, child.id)
        for (const [id, snap] of subtree) snapshots.set(id, snap)
      }

      const rootIds = importedChildren.map((c) => c.id)

      for (const child of importedChildren) {
        restoreSubtree(targetGraph, child, targetPageId, snapshots)
      }

      editor.select(rootIds)

      editor.undo.push({
        label: 'Import IDML Document',
        forward: () => {
          for (const id of rootIds) {
            if (targetGraph.getNode(id)) continue
            const snap = snapshots.get(id)
            if (!snap) continue
            restoreSubtree(targetGraph, snap, targetPageId, snapshots)
          }
          editor.select(rootIds)
          editor.requestRender()
        },
        inverse: () => {
          for (const id of rootIds.toReversed()) {
            targetGraph.deleteNode(id)
          }
          editor.clearSelection()
          editor.requestRender()
        }
      })
    }

    editor.requestRender()

    if (session.isUntouchedTab) {
      const baseName = session.file.name.replace(/\.[^.]+$/i, '')
      state.documentName = baseName
      session.setDocumentSource(session.file.name, 'idml', session.handle, session.path)
      await session.fitCurrentPageToViewport()
    }

    toast.info(`Imported ${session.pages.length} ${session.pages.length === 1 ? 'page' : 'pages'} from IDML`)
    idmlImportOpen.value = false
    currentIdmlSession.value = null
  } catch (e) {
    console.error('Failed to import IDML document:', e)
    const detail = e instanceof Error ? e.message : String(e)
    toast.error(dialogMessages.get().openFileFailed({ detail }))
  } finally {
    idmlImportLoading.value = false
  }
}

export function cancelIdmlImport(): void {
  const session = currentIdmlSession.value
  idmlImportOpen.value = false
  if (session?.isUntouchedTab && session.onDiscardTab) {
    session.onDiscardTab()
  }
  currentIdmlSession.value = null
}
