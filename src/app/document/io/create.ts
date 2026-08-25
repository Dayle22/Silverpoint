import type { Editor, EditorState } from '@open-pencil/core/editor'
import { prefetchFigmaSchema } from '@open-pencil/core/kiwi'

import { createDocumentViewportActions, downloadBlob } from '@/app/document/io/browser'
import { createDOMOpenActions } from '@/app/document/io/dom'
import { createIDMLOpenActions } from '@/app/document/io/idml'
import { createPDFOpenActions } from '@/app/document/io/pdf'
import { createOpenActions, createReloadActions } from '@/app/document/io/read'
import { createDocumentSourceActions, createDocumentSourceState } from '@/app/document/io/source'
import type { ViewportSize } from '@/app/document/io/types'
import { createFileWatcher } from '@/app/document/io/watch'

type DocumentIOState = EditorState & {
  documentName: string
  loading: boolean
  autosaveEnabled: boolean
}

export function createDocumentIOActions(
  editor: Editor,
  state: DocumentIOState,
  viewportSize: ViewportSize
) {
  const sourceState = createDocumentSourceState()

  void prefetchFigmaSchema()

  const { reloadFromDisk } = createReloadActions({
    editor,
    state,
    getFilePath: sourceState.getFilePath,
    getFileHandle: sourceState.getFileHandle,
    setSavedVersion: sourceState.setSavedVersion
  })
  const { startWatchingFile, stopWatchingFile } = createFileWatcher({
    getFilePath: sourceState.getFilePath,
    getFileHandle: sourceState.getFileHandle,
    getLastWriteTime: sourceState.getLastWriteTime,
    reloadFromDisk: () => {
      void reloadFromDisk()
    }
  })
  const { setViewportSize, fitCurrentPageToViewport } = createDocumentViewportActions(
    editor,
    viewportSize
  )
  const sourceActions = createDocumentSourceActions({
    editor,
    state,
    stopWatchingFile,
    startWatchingFile,
    getRenderer: () => editor.renderer,
    ...sourceState
  })
  const { openFigFile } = createOpenActions({
    editor,
    state,
    setDocumentSource: sourceActions.setDocumentSource,
    fitCurrentPageToViewport
  })
  const { openDOMFile, importDOMText } = createDOMOpenActions({
    editor,
    state,
    setDocumentSource: sourceActions.setDocumentSource,
    fitCurrentPageToViewport
  })
  const { openPDFFile } = createPDFOpenActions({
    editor,
    state,
    setDocumentSource: sourceActions.setDocumentSource,
    fitCurrentPageToViewport
  })
  const { openIDMLFile } = createIDMLOpenActions({
    editor,
    state,
    setDocumentSource: sourceActions.setDocumentSource,
    fitCurrentPageToViewport
  })

  return {
    downloadBlob,
    setViewportSize,
    fitCurrentPageToViewport,
    getDocumentFilePath: sourceState.getFilePath,
    setDocumentSource: sourceActions.setDocumentSource,
    setPlannedFilePath: sourceActions.setPlannedFilePath,
    startWatchingCurrentFile: sourceActions.startWatchingCurrentFile,
    disposeDocumentIO: sourceActions.disposeDocumentIO,
    openFigFile,
    openDOMFile,
    openPDFFile,
    openIDMLFile,
    importDOMText,

    saveFigFile: sourceActions.saveFigFile,
    saveFigFileAs: sourceActions.saveFigFileAs,
    isDirty: () => state.sceneVersion !== sourceState.getSavedVersion(),
    // `sceneVersion` counts renders, not edits, so any requestRender() issued
    // after setDocumentSource() (switchPage does one) leaves a just-opened
    // document looking modified. Open paths re-baseline with this once settled.
    markDocumentClean: () => sourceState.setSavedVersion(state.sceneVersion),
    getDocumentFileHandle: sourceState.getFileHandle
  }
}
