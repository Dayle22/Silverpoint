import IconBoxes from '~icons/lucide/boxes'
import IconContrast from '~icons/lucide/contrast'
import IconDice5 from '~icons/lucide/dice-5'
import IconDroplet from '~icons/lucide/droplet'
import IconEclipse from '~icons/lucide/eclipse'
import IconFocus from '~icons/lucide/focus'
import IconLayers2 from '~icons/lucide/layers-2'
import IconPalette from '~icons/lucide/palette'
import IconSpline from '~icons/lucide/spline'
import IconSquareDashedBottom from '~icons/lucide/square-dashed-bottom'

import type { Component, Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { BlurType, Effect, SceneNode } from '@open-pencil/scene-graph'
import {
  isProgressiveBlur,
  progressiveBlurPatch,
  supportsProgressiveBlur,
  uniformBlurPatch
} from '@open-pencil/scene-graph'
import {
  createBrightnessContrastEffect,
  createCurvesEffect,
  createInnerGlowEffect,
  createNoiseEffect,
  createSaturationEffect,
  isAdjustmentEffect,
  isFigmaNativeEffect,
  isInnerGlowEffect,
  isNoiseEffect
} from '@open-pencil/scene-graph/node-defaults'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useI18n } from '#vue/i18n/useI18n.js'

type EffectType = Effect['type']
export type EffectControlType = EffectType | 'INNER_GLOW'

const { panels } = useI18n()

const EFFECT_LABELS: Record<string, string> = {
  DROP_SHADOW: panels.value.dropShadow,
  INNER_SHADOW: panels.value.innerShadow,
  INNER_GLOW: panels.value.innerGlow,
  LAYER_BLUR: panels.value.layerBlur,
  BACKGROUND_BLUR: panels.value.backgroundBlur,
  FOREGROUND_BLUR: panels.value.foregroundBlur,
  NOISE: panels.value.noise,
  BRIGHTNESS_CONTRAST: panels.value.brightnessContrast,
  SATURATION: panels.value.saturationAdjustment,
  CURVES: panels.value.curvesGamma
}

export const EFFECT_ICONS: Record<EffectControlType, Component> = {
  DROP_SHADOW: IconBoxes,
  INNER_SHADOW: IconSquareDashedBottom,
  INNER_GLOW: IconEclipse,
  LAYER_BLUR: IconDroplet,
  BACKGROUND_BLUR: IconLayers2,
  FOREGROUND_BLUR: IconFocus,
  NOISE: IconDice5,
  BRIGHTNESS_CONTRAST: IconContrast,
  SATURATION: IconPalette,
  CURVES: IconSpline
}

export const EFFECT_TYPES = Object.keys(EFFECT_LABELS) as EffectControlType[]
export const EFFECT_OPTIONS = EFFECT_TYPES.map((t) => ({
  value: t,
  label: EFFECT_LABELS[t]
}))

export const BLUR_TYPE_OPTIONS: Array<{ value: BlurType; label: string }> = [
  { value: 'NORMAL', label: panels.value.blurUniform },
  { value: 'PROGRESSIVE', label: panels.value.blurProgressive }
]

export function effectIcon(type: EffectControlType): Component {
  return EFFECT_ICONS[type]
}

export {
  createBrightnessContrastEffect,
  createCurvesEffect,
  createInnerGlowEffect,
  createNoiseEffect,
  createSaturationEffect,
  isAdjustmentEffect,
  isFigmaNativeEffect,
  isInnerGlowEffect,
  isNoiseEffect,
  isProgressiveBlur,
  supportsProgressiveBlur
}

/** Blur type currently shown in the panel; blurs default to a uniform radius. */
export function blurTypeOf(effect: Effect): BlurType {
  return isProgressiveBlur(effect) ? 'PROGRESSIVE' : 'NORMAL'
}

export function effectControlType(effect: Effect): EffectControlType {
  return isInnerGlowEffect(effect) ? 'INNER_GLOW' : effect.type
}

export function isShadow(type: string) {
  return type === 'DROP_SHADOW' || type === 'INNER_SHADOW'
}

export function createDefaultEffect(): Effect {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 4,
    spread: 0,
    visible: true
  }
}

export function createEffectOfType(type: EffectControlType): Effect {
  if (type === 'INNER_GLOW') {
    return createInnerGlowEffect()
  }
  if (type === 'NOISE') {
    return createNoiseEffect()
  }
  if (type === 'BRIGHTNESS_CONTRAST') {
    return createBrightnessContrastEffect()
  }
  if (type === 'SATURATION') {
    return createSaturationEffect()
  }
  if (type === 'CURVES') {
    return createCurvesEffect()
  }
  const effect: Effect = {
    ...createDefaultEffect(),
    type: type as Effect['type']
  }
  if (!isShadow(type)) {
    effect.offset = { x: 0, y: 0 }
    effect.spread = 0
  }
  return effect
}

export function createEffectEditActions(
  editor: Editor,
  effectsBeforeScrub: Ref<Map<string, Effect[]> | null>
) {
  function scrubEffect(nodes: SceneNode[], index: number, changes: Partial<Effect>) {
    if (nodes.length === 0) return
    if (!effectsBeforeScrub.value) {
      const snapshot = new Map<string, Effect[]>()
      for (const n of nodes) {
        snapshot.set(
          n.id,
          n.effects.map((e) => ({ ...e, color: { ...e.color }, offset: { ...e.offset } }))
        )
      }
      effectsBeforeScrub.value = snapshot
    }
    for (const n of nodes) {
      const current = n.effects[index] as Effect | undefined
      if (!current) continue
      const effects = [...n.effects]
      effects[index] = { ...current, ...changes }
      editor.updateNode(n.id, { effects })
    }
    editor.requestRender()
  }

  function commitEffect(nodes: SceneNode[], index: number, changes: Partial<Effect>) {
    if (nodes.length === 0) return
    const previous = effectsBeforeScrub.value
    effectsBeforeScrub.value = null
    for (const n of nodes) {
      const current = n.effects[index] as Effect | undefined
      if (!current) continue
      const effects = [...n.effects]
      effects[index] = { ...current, ...changes }
      editor.updateNode(n.id, { effects })
    }
    editor.requestRender()
    if (!previous) return
    const label = 'Change effect'
    const restore = () => {
      for (const n of nodes) {
        const prevEffects = previous.get(n.id)
        if (prevEffects) editor.commitNodeUpdate(n.id, { effects: prevEffects }, label)
      }
    }
    if (nodes.length > 1) editor.undo.runBatch(label, restore)
    else restore()
  }

  return { scrubEffect, commitEffect }
}

export function isEffectFieldMixed(
  nodes: SceneNode[],
  index: number,
  getter: (effect: Effect) => unknown
): boolean {
  if (nodes.length <= 1) return false
  const first = nodes[0].effects[index] as Effect | undefined
  if (!first) return false
  const firstValue = getter(first)
  for (let i = 1; i < nodes.length; i++) {
    const effect = nodes[i].effects[index] as Effect | undefined
    if (!effect || getter(effect) !== firstValue) return true
  }
  return false
}

export function createEffectControlActions(expandedIndex: Ref<number | null>) {
  function updateType(
    patch: (index: number, changes: Partial<Effect>) => void,
    node: SceneNode | null,
    index: number,
    type: EffectControlType
  ) {
    if (!node) return
    if (
      type === 'INNER_GLOW' ||
      type === 'NOISE' ||
      type === 'BRIGHTNESS_CONTRAST' ||
      type === 'SATURATION' ||
      type === 'CURVES'
    ) {
      patch(index, createEffectOfType(type))
      return
    }
    const changes: Partial<Effect> = { type }
    if (!isShadow(type)) {
      changes.offset = { x: 0, y: 0 }
      changes.spread = 0
    } else if (!isShadow(node.effects[index].type)) {
      changes.offset = { x: 0, y: 4 }
      changes.spread = 0
      changes.color = { r: 0, g: 0, b: 0, a: 0.25 }
    }
    patch(index, changes)
  }

  function updateColor(
    patch: (index: number, changes: Partial<Effect>) => void,
    index: number,
    color: Color
  ) {
    patch(index, { color })
  }

  function updateBlurType(
    patch: (index: number, changes: Partial<Effect>) => void,
    node: SceneNode | null,
    index: number,
    blurType: BlurType
  ) {
    const effect = node?.effects[index]
    if (!effect || !supportsProgressiveBlur(effect)) return
    // The ramp fields survive a switch back to uniform, so toggling between the
    // two modes restores the ramp the user last set rather than resetting it.
    patch(index, blurType === 'PROGRESSIVE' ? progressiveBlurPatch(effect) : uniformBlurPatch())
  }

  function adjustExpandedAfterRemove(index: number) {
    if (expandedIndex.value === index) expandedIndex.value = null
    else if (expandedIndex.value !== null && expandedIndex.value > index) expandedIndex.value--
  }

  function handleRemove(removeFn: (index: number) => void, index: number) {
    removeFn(index)
    adjustExpandedAfterRemove(index)
  }

  function toggleExpand(index: number) {
    expandedIndex.value = expandedIndex.value === index ? null : index
  }

  return {
    updateType,
    updateColor,
    updateBlurType,
    handleRemove,
    adjustExpandedAfterRemove,
    toggleExpand
  }
}
