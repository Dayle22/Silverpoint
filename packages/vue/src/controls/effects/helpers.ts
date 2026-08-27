import type { Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'

import { useI18n } from '#vue/i18n/useI18n.js'

import {
  createBrightnessContrastEffect,
  createCurvesEffect,
  createExposureEffect,
  createGlassEffect,
  createHueSaturationEffect,
  createNoiseEffect,
  createSaturationEffect,
  createTextureEffect,
  createVibranceEffect,
  isAdjustmentEffect,
  isGlassEffect,
  isNoiseEffect,
  isTextureEffect
} from '@open-pencil/scene-graph/node-defaults'
import {
  isProgressiveBlur,
  progressiveBlurPatch,
  supportsProgressiveBlur,
  uniformBlurPatch
} from '@open-pencil/scene-graph'

type EffectType = Effect['type']

const { panels } = useI18n()

const EFFECT_LABELS: Record<string, string> = {
  DROP_SHADOW: panels.value.dropShadow,
  INNER_SHADOW: panels.value.innerShadow,
  LAYER_BLUR: panels.value.layerBlur,
  BACKGROUND_BLUR: panels.value.backgroundBlur,
  FOREGROUND_BLUR: panels.value.foregroundBlur,
  BRIGHTNESS_CONTRAST: panels.value.brightnessContrast,
  HUE_SATURATION: panels.value.hueSaturation,
  EXPOSURE: panels.value.exposure,
  VIBRANCE: panels.value.vibrance,
  NOISE: panels.value.noise,
  TEXTURE: panels.value.texture,
  GLASS: panels.value.glass,
  SATURATION: panels.value.saturation,
  CURVES: panels.value.curves
}

export const EFFECT_TYPES = Object.keys(EFFECT_LABELS) as EffectType[]
export const EFFECT_OPTIONS = EFFECT_TYPES.map((t) => ({
  value: t,
  label: EFFECT_LABELS[t] ?? t
}))

export function isShadow(type: string) {
  return type === 'DROP_SHADOW' || type === 'INNER_SHADOW'
}

export function createEffectOfType(type: EffectType): Effect {
  switch (type) {
    case 'BRIGHTNESS_CONTRAST':
      return createBrightnessContrastEffect()
    case 'HUE_SATURATION':
      return createHueSaturationEffect()
    case 'EXPOSURE':
      return createExposureEffect()
    case 'VIBRANCE':
      return createVibranceEffect()
    case 'SATURATION':
      return createSaturationEffect()
    case 'CURVES':
      return createCurvesEffect()
    case 'NOISE':
      return createNoiseEffect()
    case 'TEXTURE':
      return createTextureEffect()
    case 'GLASS':
      return createGlassEffect()
    case 'INNER_SHADOW':
      return {
        type: 'INNER_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 4,
        spread: 0,
        visible: true
      }
    case 'LAYER_BLUR':
    case 'BACKGROUND_BLUR':
    case 'FOREGROUND_BLUR':
      return {
        type,
        color: TRANSPARENT,
        offset: { x: 0, y: 0 },
        radius: 4,
        spread: 0,
        visible: true
      }
    default:
      return createDefaultEffect()
  }
}

export {
  isAdjustmentEffect,
  isGlassEffect,
  isNoiseEffect,
  isProgressiveBlur,
  isTextureEffect,
  progressiveBlurPatch,
  supportsProgressiveBlur,
  uniformBlurPatch
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

export interface EffectEditSnapshot {
  effects: Effect[]
  effectStyleId: string | null
}

export function createEffectEditActions(
  editor: Editor,
  effectsBeforeScrub: Ref<EffectEditSnapshot | null>
) {
  function scrubEffect(node: SceneNode | null, index: number, changes: Partial<Effect>) {
    if (!node) return
    if (!effectsBeforeScrub.value) {
      effectsBeforeScrub.value = {
        effects: node.effects.map((e) => ({
          ...e,
          color: { ...e.color },
          offset: { ...e.offset }
        })),
        effectStyleId: node.effectStyleId
      }
    }
    const effects = [...node.effects]
    effects[index] = { ...effects[index], ...changes }
    editor.updateNode(node.id, { effects })
    editor.requestRender()
  }

  function commitEffect(node: SceneNode | null, index: number, changes: Partial<Effect>) {
    if (!node) return
    const previous = effectsBeforeScrub.value
    effectsBeforeScrub.value = null
    const effects = [...node.effects]
    effects[index] = { ...effects[index], ...changes }
    editor.updateNode(node.id, { effects })
    editor.requestRender()
    if (previous) {
      editor.commitNodeUpdate(
        node.id,
        { effects: previous.effects, effectStyleId: previous.effectStyleId },
        'Change effect'
      )
    }
  }

  return { scrubEffect, commitEffect }
}

export function createEffectControlActions(expandedIndex: Ref<number | null>) {
  function updateType(
    patch: (index: number, changes: Partial<Effect>) => void,
    node: SceneNode | null,
    index: number,
    type: EffectType
  ) {
    if (!node) return
    const defaultShape = createEffectOfType(type)
    const changes: Partial<Effect> = { ...defaultShape, type }
    if (!isShadow(type)) {
      changes.offset = { x: 0, y: 0 }
      changes.spread = 0
    } else if (!isShadow(node.effects[index].type)) {
      changes.offset = { x: 0, y: 4 }
      changes.spread = 0
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

  function adjustExpandedAfterRemove(index: number) {
    if (expandedIndex.value === index) expandedIndex.value = null
    else if (expandedIndex.value !== null && expandedIndex.value > index) expandedIndex.value--
  }

  function handleRemove(removeFn: (index: number) => void, index: number) {
    removeFn(index)
    adjustExpandedAfterRemove(index)
  }

  function toggleBlurType(
    patch: (index: number, changes: Partial<Effect>) => void,
    effect: Effect,
    index: number,
    blurType: 'NORMAL' | 'PROGRESSIVE'
  ) {
    if (blurType === 'PROGRESSIVE') {
      patch(index, progressiveBlurPatch(effect))
    } else {
      patch(index, uniformBlurPatch())
    }
  }

  function toggleExpand(index: number) {
    expandedIndex.value = expandedIndex.value === index ? null : index
  }

  return {
    updateType,
    updateColor,
    toggleBlurType,
    handleRemove,
    adjustExpandedAfterRemove,
    toggleExpand
  }
}
