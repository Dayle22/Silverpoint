import { ref } from 'vue'

import type { Editor, EditorState } from '@open-pencil/core/editor'
import { restoreSubtree, snapshotSubtree } from '@open-pencil/core/editor/clipboard/subtree-history'
import {
  importPdfPage,
  readPdfSummary,
  type PdfImportDiagnostic,
  type PdfPageSummary
} from '@open-pencil/core/io/formats/pdf'
import type { SceneNode } from '@open-pencil/scene-graph'
import { dialogMessages } from '@open-pencil/vue'

import { toast } from '@/app/shell/ui'

export interface PDFImportSession {
  file: File
  data: Uint8Array
  handle?: FileSystemFileHandle
  path?: string
  pages: PdfPageSummary[]
  diagnostics: PdfImportDiagnostic[]
  selectedPage: number
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

export const pdfImportOpen = ref(false)
export const pdfImportLoading = ref(false)
export const currentPdfSession = ref<PDFImportSession | null>(null)

type OpenPDFFileOptions = {
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

export function createPDFOpenActions({
  editor,
  state,
  setDocumentSource,
  fitCurrentPageToViewport,
  isUntouchedTab = false,
  onDiscardTab
}: OpenPDFFileOptions) {
  async function openPDFFile(
    file: File,
    options: { handle?: FileSystemFileHandle; path?: string } = {}
  ): Promise<void> {
    try {
      state.loading = true
      const data = new Uint8Array(await file.arrayBuffer())
      const { pages, diagnostics } = await readPdfSummary(data)

      const fatalError = diagnostics.find((d) => d.severity === 'error')
      if (fatalError || pages.length === 0) {
        const message =
          fatalError?.message || dialogMessages.get().openFileFailed({ detail: 'No pages in PDF' })
        toast.error(message)
        if (onDiscardTab) onDiscardTab()
        return
      }

      currentPdfSession.value = {
        file,
        data,
        handle: options.handle,
        path: options.path,
        pages,
        diagnostics,
        selectedPage: 1,
        editor,
        state,
        isUntouchedTab,
        setDocumentSource,
        fitCurrentPageToViewport,
        onDiscardTab
      }
      pdfImportOpen.value = true
    } catch (e) {
      console.error('Failed to parse PDF summary:', e)
      const detail = e instanceof Error ? e.message : String(e)
      toast.error(dialogMessages.get().openFileFailed({ detail }))
      if (onDiscardTab) onDiscardTab()
    } finally {
      state.loading = false
    }
  }

  return { openPDFFile }
}

export async function confirmPdfImport(): Promise<void> {
  const session = currentPdfSession.value
  if (!session) return

  try {
    pdfImportLoading.value = true
    const { graph: importedGraph, diagnostics } = await importPdfPage(
      session.data,
      session.selectedPage,
      { fileName: session.file.name }
    )

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
        label: 'Import PDF Page',
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
      session.setDocumentSource(session.file.name, 'pdf', session.handle, session.path)
      await session.fitCurrentPageToViewport()
    }

    toast.info(`Imported page ${session.selectedPage} of ${session.pages.length}`)
    pdfImportOpen.value = false
    currentPdfSession.value = null
  } catch (e) {
    console.error('Failed to import PDF page:', e)
    const detail = e instanceof Error ? e.message : String(e)
    toast.error(dialogMessages.get().openFileFailed({ detail }))
  } finally {
    pdfImportLoading.value = false
  }
}

export function cancelPdfImport(): void {
  const session = currentPdfSession.value
  pdfImportOpen.value = false
  if (session?.isUntouchedTab && session.onDiscardTab) {
    session.onDiscardTab()
  }
  currentPdfSession.value = null
}
