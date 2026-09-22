import type { ToolCapability } from '@open-pencil/core/tools'
export type { ToolCapability } from '@open-pencil/core/tools'

export type ToolTier = 'core' | 'extended' | 'advanced'

export type ToolEffect = 'read' | 'write'
export type ToolAvailability = 'default' | 'eval' | 'filesystem'
export interface ToolDescriptor {
  name: string
  description: string
  returns?: string
  effect: ToolEffect
  availability: ToolAvailability
  tier?: ToolTier
  capabilities: ToolCapability[]
  enabled: boolean
}

export interface ToolPolicy {
  allowEval: boolean
  disabledTools: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const TOOL_EFFECTS: ReadonlySet<string> = new Set<ToolEffect>(['read', 'write'])
const TOOL_AVAILABILITIES: ReadonlySet<string> = new Set<ToolAvailability>([
  'default',
  'eval',
  'filesystem'
])
const TOOL_CAPABILITIES: ReadonlySet<string> = new Set<ToolCapability>([
  'document:read',
  'document:write',
  'filesystem:read',
  'filesystem:write',
  'network:access',
  'code:execute'
])

const TOOL_TIERS: ReadonlySet<string> = new Set<ToolTier>(['core', 'extended', 'advanced'])

export function parseToolDescriptor(value: unknown): ToolDescriptor | null {
  if (!isRecord(value)) return null
  const { name, description, returns, effect, availability, tier, capabilities, enabled } = value
  if (typeof name !== 'string' || !name) return null
  if (typeof description !== 'string') return null
  if (returns !== undefined && typeof returns !== 'string') return null
  if (typeof effect !== 'string' || !TOOL_EFFECTS.has(effect)) return null
  if (typeof availability !== 'string' || !TOOL_AVAILABILITIES.has(availability)) return null
  if (tier !== undefined && (typeof tier !== 'string' || !TOOL_TIERS.has(tier))) return null
  if (typeof enabled !== 'boolean') return null
  if (
    !Array.isArray(capabilities) ||
    capabilities.some(
      (capability) => typeof capability !== 'string' || !TOOL_CAPABILITIES.has(capability)
    )
  ) {
    return null
  }
  const descriptor: ToolDescriptor = {
    name,
    description,
    effect: effect as ToolEffect,
    availability: availability as ToolAvailability,
    capabilities: capabilities as ToolCapability[],
    enabled
  }
  if (returns) descriptor.returns = returns
  if (tier) descriptor.tier = tier as ToolTier
  return descriptor
}
