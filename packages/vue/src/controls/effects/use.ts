import { onScopeDispose, ref, watchEffect } from 'vue'

import type { Effect } from '@open-pencil/scene-graph'

import {
  BLUR_TYPE_OPTIONS,
  EFFECT_OPTIONS,
  blurTypeOf,
  createDefaultEffect,
  createEffectControlActions,
  createEffectEditActions,
  createEffectOfType,
  effectControlType,
  effectIcon,
  isAdjustmentEffect,
  isEffectFieldMixed,
  isProgressiveBlur,
  isShadow,
  supportsProgressiveBlur
} from '#vue/controls/effects/helpers'
import { useEditor } from '#vue/editor/context'

/**
 * Returns effect-editing helpers for property panels.
 *
 * This composable manages default effect creation, expanded-row state,
 * scrub-preview behavior, and effect type/color updates.
 */
export function useEffectsControls() {
  const editor = useEditor()

  const expandedIndex = ref<number | null>(null)
  const effectsBeforeScrub = ref<Map<string, Effect[]> | null>(null)
  const editActions = createEffectEditActions(editor, effectsBeforeScrub)
  const controlActions = createEffectControlActions(expandedIndex)

  // The canvas ramp handles follow the expanded row: they appear only while a
  // progressive blur's settings are open on a single selected node.
  watchEffect(() => {
    void editor.state.sceneVersion
    const index = expandedIndex.value
    const ids = [...editor.state.selectedIds]
    if (index === null || ids.length !== 1) {
      editor.setProgressiveBlurEdit(null)
      return
    }
    const effect = editor.graph.getNode(ids[0])?.effects[index]
    editor.setProgressiveBlurEdit(
      effect && isProgressiveBlur(effect) ? { nodeId: ids[0], effectIndex: index } : null
    )
  })

  onScopeDispose(() => {
    editor.setProgressiveBlurEdit(null)
  })

  return {
    expandedIndex,
    effectOptions: EFFECT_OPTIONS,
    blurTypeOptions: BLUR_TYPE_OPTIONS,
    effectControlType,
    effectIcon,
    createDefaultEffect,
    createEffectOfType,
    isShadow,
    isAdjustmentEffect,
    supportsProgressiveBlur,
    isProgressiveBlur,
    blurTypeOf,
    isEffectFieldMixed,
    ...editActions,
    ...controlActions
  }
}
