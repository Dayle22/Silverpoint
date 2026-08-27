import { ref } from 'vue'

import {
  EFFECT_OPTIONS,
  createDefaultEffect,
  createEffectControlActions,
  createEffectEditActions,
  createEffectOfType,
  isAdjustmentEffect,
  isGlassEffect,
  isNoiseEffect,
  isShadow,
  isTextureEffect,
  type EffectEditSnapshot
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
  const effectsBeforeScrub = ref<EffectEditSnapshot | null>(null)
  const editActions = createEffectEditActions(editor, effectsBeforeScrub)
  const controlActions = createEffectControlActions(expandedIndex)

  return {
    expandedIndex,
    effectOptions: EFFECT_OPTIONS,
    createDefaultEffect,
    createEffectOfType,
    isShadow,
    isAdjustmentEffect,
    isNoiseEffect,
    isTextureEffect,
    isGlassEffect,
    ...editActions,
    ...controlActions
  }
}
