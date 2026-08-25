import type { Color } from '@open-pencil/scene-graph/primitives'

import { populateLazyFigImportRoots } from '#core/kiwi/fig/lazy-import'
import { computeAllLayouts } from '#core/layout'
import { fontManager } from '#core/text/fonts'
import { collectGraphFontRequirements } from '#core/text/requirements'
import { missingGraphFontScripts } from '#core/text/resolved-requirements'

import { createPageViewportStore } from './page-viewports'
import type { EditorContext } from './types'

export type PageGuideAxis = 'X' | 'Y'

export interface PageGuide {
  axis: PageGuideAxis
  offset: number
}

function isPageGuide(value: unknown): value is PageGuide {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const guide = value as { axis?: unknown; offset?: unknown }
  return (
    (guide.axis === 'X' || guide.axis === 'Y') &&
    typeof guide.offset === 'number' &&
    Number.isFinite(guide.offset)
  )
}

export function createPageActions(ctx: EditorContext, cancelAnimation?: () => void) {
  const pageViewportStore = createPageViewportStore(ctx, cancelAnimation)

  function getPage(pageId = ctx.state.currentPageId) {
    const page = ctx.graph.getNode(pageId)
    return page?.type === 'CANVAS' ? page : null
  }

  function getPageGuides(pageId?: string): PageGuide[] {
    const guides = getPage(pageId)?.source.fig.rawNodeFields.guides
    if (!Array.isArray(guides)) return []
    return guides.filter(isPageGuide).map(({ axis, offset }) => ({ axis, offset }))
  }

  function writePageGuideSource(
    pageId: string,
    source: NonNullable<ReturnType<typeof getPage>>['source']
  ) {
    ctx.graph.preserveSourceMetadataDuring(() => {
      ctx.graph.updateNode(pageId, { source })
    })
    ctx.requestRender()
  }

  function updatePageGuides(
    pageId: string | undefined,
    mutate: (guides: unknown[]) => unknown[] | null,
    label: string
  ) {
    const page = getPage(pageId)
    if (!page) return
    const raw = page.source.fig.rawNodeFields.guides
    const nextGuides = mutate(Array.isArray(raw) ? structuredClone(raw) : [])
    if (!nextGuides) return
    const previousSource = structuredClone(page.source)
    const nextSource = structuredClone(page.source)
    nextSource.fig.rawNodeFields.guides = nextGuides
    writePageGuideSource(page.id, nextSource)
    ctx.undo.push({
      label,
      forward: () => writePageGuideSource(page.id, structuredClone(nextSource)),
      inverse: () => writePageGuideSource(page.id, structuredClone(previousSource))
    })
  }

  function findRawGuideIndex(guides: unknown[], index: number): number | null {
    let validIndex = -1
    for (let rawIndex = 0; rawIndex < guides.length; rawIndex += 1) {
      if (!isPageGuide(guides[rawIndex])) continue
      validIndex += 1
      if (validIndex === index) return rawIndex
    }
    return null
  }

  function addPageGuide(axis: string, offset: number, pageId?: string) {
    if ((axis !== 'X' && axis !== 'Y') || !Number.isFinite(offset)) return
    updatePageGuides(pageId, (guides) => [...guides, { axis, offset }], 'Add guide')
  }

  function updatePageGuide(index: number, offset: number, pageId?: string) {
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(offset)) return
    updatePageGuides(
      pageId,
      (guides) => {
        const rawIndex = findRawGuideIndex(guides, index)
        if (rawIndex === null) return null
        const guide = guides[rawIndex]
        if (!isPageGuide(guide)) return null
        guides[rawIndex] = { ...guide, offset }
        return guides
      },
      'Move guide'
    )
  }

  function removePageGuide(index: number, pageId?: string) {
    if (!Number.isInteger(index) || index < 0) return
    updatePageGuides(
      pageId,
      (guides) => {
        const rawIndex = findRawGuideIndex(guides, index)
        if (rawIndex === null) return null
        guides.splice(rawIndex, 1)
        return guides
      },
      'Delete guide'
    )
  }

  function setPageGuideOffset(index: number, offset: number, pageId?: string) {
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(offset)) return
    const page = getPage(pageId)
    if (!page) return
    const guides = Array.isArray(page.source.fig.rawNodeFields.guides)
      ? structuredClone(page.source.fig.rawNodeFields.guides)
      : []
    const rawIndex = findRawGuideIndex(guides, index)
    if (rawIndex === null) return
    const guide = guides[rawIndex]
    if (!isPageGuide(guide)) return
    guides[rawIndex] = { ...guide, offset }
    const source = structuredClone(page.source)
    source.fig.rawNodeFields.guides = guides
    writePageGuideSource(page.id, source)
  }

  function commitPageGuideMove(index: number, previousOffset: number, pageId?: string) {
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(previousOffset)) return
    const page = getPage(pageId)
    if (!page) return
    const current = getPageGuides(page.id).at(index)
    if (!current || current.offset === previousOffset) return
    const nextSource = structuredClone(page.source)
    const previousSource = structuredClone(page.source)
    const previousGuides = Array.isArray(page.source.fig.rawNodeFields.guides)
      ? structuredClone(page.source.fig.rawNodeFields.guides)
      : []
    const rawIndex = findRawGuideIndex(previousGuides, index)
    if (rawIndex === null) return
    const guide = previousGuides[rawIndex]
    if (!isPageGuide(guide)) return
    previousGuides[rawIndex] = { ...guide, offset: previousOffset }
    previousSource.fig.rawNodeFields.guides = previousGuides
    ctx.undo.push({
      label: 'Move guide',
      forward: () => writePageGuideSource(page.id, structuredClone(nextSource)),
      inverse: () => writePageGuideSource(page.id, structuredClone(previousSource))
    })
  }

  async function switchPage(pageId: string) {
    const page = ctx.graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return

    pageViewportStore.saveCurrentPageViewport()

    const previousPageId = ctx.state.currentPageId
    ctx.state.currentPageId = pageId
    ctx.state.enteredContainerId = null
    ctx.setSelectedIds(new Set())
    if (previousPageId !== pageId) ctx.emitEditorEvent('page:changed', pageId, previousPageId)

    pageViewportStore.restorePageViewport(pageId)

    const populated = populateLazyFigImportRoots(ctx.graph, [pageId])

    const childIds = ctx.graph.getChildren(pageId).map((node) => node.id)
    const toLoad = fontManager.collectFontKeys(ctx.graph, childIds)
    const requirements = collectGraphFontRequirements(ctx.graph, childIds)
    fontManager.blockNodesUntilFontsResolve(childIds)
    try {
      const results = await Promise.all(
        toLoad.map(([family, style]) => ctx.loadFont(family, style, requirements.characters))
      )
      const requiredFallbacks = missingGraphFontScripts(requirements)
      const fallbacks = await fontManager.ensureFallbackPack(
        requiredFallbacks,
        requirements.characters
      )
      const facesReady = results.every((result) => result !== null)
      const fallbacksReady = requiredFallbacks.every(
        (script) => (fallbacks[script]?.length ?? 0) > 0
      )
      if (facesReady && fallbacksReady) {
        for (const node of requirements.nodes) if (node.type === 'TEXT') node.textPicture = null
      }
    } finally {
      fontManager.unblockNodes(childIds)
      ctx.getRenderer()?.invalidateAllPictures()
    }
    if (ctx.getRenderer() || populated) {
      computeAllLayouts(ctx.graph, pageId)
    }
    ctx.requestRender()
  }

  function addPage(name?: string) {
    const pages = ctx.graph.getPages()
    const pageName = name ?? `Page ${pages.length + 1}`
    const page = ctx.graph.addPage(pageName)
    void switchPage(page.id)
    return page.id
  }

  function deletePage(pageId: string) {
    const pages = ctx.graph.getPages()
    if (pages.length <= 1) return
    const idx = pages.findIndex((p) => p.id === pageId)
    ctx.graph.deleteNode(pageId)
    pageViewportStore.deletePageViewport(pageId)
    if (ctx.state.currentPageId === pageId) {
      const newIdx = Math.min(idx, pages.length - 2)
      const remaining = ctx.graph.getPages()
      void switchPage(remaining[newIdx].id)
    }
  }

  function movePage(pageId: string, index: number) {
    const pages = ctx.graph.getPages()
    const currentIndex = pages.findIndex((page) => page.id === pageId)
    if (currentIndex === -1) return

    const nextIndex = Math.max(0, Math.min(index, pages.length - 1))
    if (nextIndex === currentIndex) return

    ctx.graph.insertChildAt(pageId, ctx.graph.rootId, nextIndex)
  }

  function renamePage(pageId: string, name: string) {
    ctx.graph.updateNode(pageId, { name })
  }

  function setPageColor(color: Color) {
    ctx.state.pageColor = color
    ctx.requestRender()
  }

  return {
    switchPage,
    addPage,
    deletePage,
    movePage,
    renamePage,
    setPageColor,
    getPageGuides,
    addPageGuide,
    updatePageGuide,
    removePageGuide,
    setPageGuideOffset,
    commitPageGuideMove,
    clearPageViewports: pageViewportStore.clearPageViewports
  }
}
