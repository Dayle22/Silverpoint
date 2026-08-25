import type { Fill, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { TRANSPARENT } from '#core/constants'
import { resolvePasteTarget } from '#core/editor/clipboard/paste-target'
import type { EditorContext } from '#core/editor/types'
import { computeImageHash } from '#core/figma-api'

const IMAGE_MAX_DIMENSION = 4096
const IMAGE_GAP = 20

export function createClipboardImageActions(ctx: EditorContext) {
  function storeImage(bytes: Uint8Array): string {
    const hash = computeImageHash(bytes)
    ctx.graph.images.set(hash, bytes)
    return hash
  }

  function decodeImageDimensions(bytes: Uint8Array): { w: number; h: number } | null {
    const ck = ctx.getCk()
    if (!ck) return null
    const skImg = ck.MakeImageFromEncoded(bytes)
    if (!skImg) return null
    let w = skImg.width()
    let h = skImg.height()
    skImg.delete()
    if (w > IMAGE_MAX_DIMENSION || h > IMAGE_MAX_DIMENSION) {
      const ratio = Math.min(IMAGE_MAX_DIMENSION / w, IMAGE_MAX_DIMENSION / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
    }
    return { w, h }
  }

  function createImageNode(
    bytes: Uint8Array,
    parentId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    name = 'Image'
  ): { hash: string; snapshot: SceneNode } {
    const hash = storeImage(bytes)
    const displayName = name.replace(/\.[^.]+$/, '')
    const fill: Fill = {
      type: 'IMAGE',
      imageHash: hash,
      imageScaleMode: 'FILL',
      color: TRANSPARENT,
      opacity: 1,
      visible: true
    }
    const node = ctx.graph.createNode('RECTANGLE', parentId, {
      name: displayName,
      x,
      y,
      width: w,
      height: h,
      fills: [fill]
    })
    return { hash, snapshot: structuredClone(node) }
  }

  async function placeImageFiles(files: File[], cx: number, cy: number) {
    const prepared: Array<{ bytes: Uint8Array; name: string; w: number; h: number }> = []
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const dims = decodeImageDimensions(bytes)
      if (dims) prepared.push({ bytes, name: file.name, ...dims })
    }
    if (!prepared.length) return

    const parentId = resolvePasteTarget(ctx)
    const parent = ctx.graph.getNode(parentId)
    if (!parent) return
    const parentInverse = Matrix.invert(getWorldMatrix(parent, ctx.graph))
    if (!parentInverse) return
    const localDrop = Matrix.mapPoint(parentInverse, { x: cx, y: cy })

    let totalW = 0
    for (const p of prepared) totalW += p.w
    totalW += IMAGE_GAP * (prepared.length - 1)
    const maxH = Math.max(...prepared.map((p) => p.h))

    let curX = localDrop.x - totalW / 2
    const topY = localDrop.y - maxH / 2
    const ids: string[] = []
    const entries: Array<{ hash: string; bytes: Uint8Array; snapshot: SceneNode }> = []
    for (const p of prepared) {
      const { hash, snapshot } = createImageNode(
        p.bytes,
        parentId,
        curX,
        topY,
        p.w,
        p.h,
        p.name
      )
      ids.push(snapshot.id)
      entries.push({ hash, bytes: p.bytes, snapshot })
      curX += p.w + IMAGE_GAP
    }
    if (ids.length) {
      const previousSelection = new Set(ctx.state.selectedIds)
      ctx.setSelectedIds(new Set(ids))
      ctx.undo.push({
        label: 'Place image',
        forward: () => {
          for (const { hash, bytes, snapshot } of entries) {
            ctx.graph.images.set(hash, bytes)
            const { parentId: _parentId, childIds: _childIds, ...rest } = snapshot
            ctx.graph.createNode(snapshot.type, parentId, { ...rest, id: snapshot.id })
          }
          ctx.setSelectedIds(new Set(ids))
        },
        inverse: () => {
          for (const id of ids.toReversed()) ctx.graph.deleteNode(id)
          ctx.setSelectedIds(previousSelection)
        }
      })
      ctx.requestRender()
    }
  }

  return { storeImage, placeImageFiles }
}
