import type { SceneGraph, SceneNode, Fill, Stroke, Effect, StyleRun } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { checkPrintGamut, DEFAULT_GAMUT_TOLERANCE, type PrintGamutProfile } from './gamut'

export interface GamutFinding {
  nodeId: string
  source: 'fill' | 'stroke' | 'effect' | 'text-fill'
  index: number // paint index within that source
  color: Color
  excessChroma: number
}

function analyzeFills(
  nodeId: string,
  fills: Fill[],
  profile: PrintGamutProfile,
  tolerance: number,
  findings: GamutFinding[]
) {
  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i]
    if (!fill.visible) continue

    if (fill.type === 'IMAGE') {
      findings.push({
        nodeId,
        source: 'fill',
        index: i,
        color: fill.color,
        excessChroma: -1
      })
    } else if (fill.gradientStops && fill.gradientStops.length > 0) {
      for (let s = 0; s < fill.gradientStops.length; s++) {
        const stop = fill.gradientStops[s]
        const verdict = checkPrintGamut(stop.color, profile, tolerance)
        if (!verdict.inGamut) {
          findings.push({
            nodeId,
            source: 'fill',
            index: s,
            color: stop.color,
            excessChroma: verdict.excessChroma
          })
        }
      }
    } else {
      const verdict = checkPrintGamut(fill.color, profile, tolerance)
      if (!verdict.inGamut) {
        findings.push({
          nodeId,
          source: 'fill',
          index: i,
          color: fill.color,
          excessChroma: verdict.excessChroma
        })
      }
    }
  }
}

function analyzeStrokes(
  nodeId: string,
  strokes: Stroke[],
  profile: PrintGamutProfile,
  tolerance: number,
  findings: GamutFinding[]
) {
  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i]
    if (!stroke.visible) continue
    const verdict = checkPrintGamut(stroke.color, profile, tolerance)
    if (!verdict.inGamut) {
      findings.push({
        nodeId,
        source: 'stroke',
        index: i,
        color: stroke.color,
        excessChroma: verdict.excessChroma
      })
    }
  }
}

function analyzeEffects(
  nodeId: string,
  effects: Effect[],
  profile: PrintGamutProfile,
  tolerance: number,
  findings: GamutFinding[]
) {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]
    if (!effect.visible) continue
    const verdict = checkPrintGamut(effect.color, profile, tolerance)
    if (!verdict.inGamut) {
      findings.push({
        nodeId,
        source: 'effect',
        index: i,
        color: effect.color,
        excessChroma: verdict.excessChroma
      })
    }
  }
}

function analyzeStyleRuns(
  nodeId: string,
  runs: StyleRun[],
  profile: PrintGamutProfile,
  tolerance: number,
  findings: GamutFinding[]
) {
  for (const run of runs) {
    if (!run.style.fills) continue
    for (let f = 0; f < run.style.fills.length; f++) {
      const fill = run.style.fills[f]
      if (!fill.visible) continue

      if (fill.type === 'IMAGE') {
        findings.push({
          nodeId,
          source: 'text-fill',
          index: f,
          color: fill.color,
          excessChroma: -1
        })
      } else if (fill.gradientStops && fill.gradientStops.length > 0) {
        for (let s = 0; s < fill.gradientStops.length; s++) {
          const stop = fill.gradientStops[s]
          const verdict = checkPrintGamut(stop.color, profile, tolerance)
          if (!verdict.inGamut) {
            findings.push({
              nodeId,
              source: 'text-fill',
              index: s,
              color: stop.color,
              excessChroma: verdict.excessChroma
            })
          }
        }
      } else {
        const verdict = checkPrintGamut(fill.color, profile, tolerance)
        if (!verdict.inGamut) {
          findings.push({
            nodeId,
            source: 'text-fill',
            index: f,
            color: fill.color,
            excessChroma: verdict.excessChroma
          })
        }
      }
    }
  }
}

function inspectNode(
  node: SceneNode,
  pageId: string,
  profile: PrintGamutProfile,
  tolerance: number,
  findings: GamutFinding[]
) {
  if (node.id === pageId || node.type === 'CANVAS') return

  if (Array.isArray(node.fills)) {
    analyzeFills(node.id, node.fills, profile, tolerance, findings)
  }
  if (Array.isArray(node.strokes)) {
    analyzeStrokes(node.id, node.strokes, profile, tolerance, findings)
  }
  if (Array.isArray(node.effects)) {
    analyzeEffects(node.id, node.effects, profile, tolerance, findings)
  }
  if (Array.isArray(node.styleRuns)) {
    analyzeStyleRuns(node.id, node.styleRuns, profile, tolerance, findings)
  }
}

/**
 * Pure analysis function that walks the page subtree and checks fills, strokes,
 * effects, and text style runs against the approximate print gamut.
 *
 * Never mutates the scene graph, undo stack, or document properties.
 */
export function analyzeGraphGamut(
  graph: SceneGraph,
  pageId: string,
  profile: PrintGamutProfile,
  tolerance: number = DEFAULT_GAMUT_TOLERANCE
): GamutFinding[] {
  const findings: GamutFinding[] = []

  function checkNode(nodeId: string) {
    const node = graph.getNode(nodeId)
    if (!node) return

    inspectNode(node, pageId, profile, tolerance, findings)

    const children = graph.getChildren(nodeId)
    for (const child of children) {
      checkNode(child.id)
    }
  }

  checkNode(pageId)
  return findings
}
