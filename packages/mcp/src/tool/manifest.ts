import type { ToolDef } from '@open-pencil/core/tools'
import { ALL_TOOLS, CORE_TOOLS, toolChangesDocument, isToolExposed } from '@open-pencil/core/tools'

import type {
  ToolAvailability,
  ToolCapability,
  ToolDescriptor,
  ToolEffect,
  ToolTier
} from '#mcp/tool/metadata'

const CORE_TOOL_NAMES = new Set(CORE_TOOLS.map((t) => t.name))

export function coreToolEffect(def: ToolDef): ToolEffect {
  return toolChangesDocument(def) ? 'write' : 'read'
}

export function coreToolCapabilities(def: ToolDef): ToolCapability[] {
  return [...def.capabilities]
}

export function coreToolAvailability(def: ToolDef): ToolAvailability {
  return def.availability
}

export function coreToolTier(def: ToolDef): ToolTier {
  if (def.name === 'eval') return 'advanced'
  return CORE_TOOL_NAMES.has(def.name) ? 'core' : 'extended'
}

function coreToolDescriptor(def: ToolDef): ToolDescriptor {
  return {
    name: def.name,
    description: def.returns ? `${def.description} (Returns: ${def.returns})` : def.description,
    returns: def.returns,
    effect: coreToolEffect(def),
    availability: coreToolAvailability(def),
    tier: coreToolTier(def),
    capabilities: coreToolCapabilities(def),
    enabled: true
  }
}

export function getMCPToolDefinitions() {
  return ALL_TOOLS.filter((def) => isToolExposed(def, 'mcp'))
}

export function createToolDescriptors(filesystemEnabled: boolean): ToolDescriptor[] {
  const descriptors = getMCPToolDefinitions().map(coreToolDescriptor)
  descriptors.push(
    {
      name: 'list_tools',
      description:
        'List available OpenPencil tools with their descriptions, tiers (core/extended/advanced), and effects (read/write). Filter by tier or effect to discover tools without loading all schemas.',
      effect: 'read',
      availability: 'default',
      tier: 'core',
      capabilities: [],
      enabled: true
    },
    {
      name: 'list_documents',
      description:
        'List all open OpenPencil documents/tabs. Returns {documents: [{id, name, path, currentPage, pages: [{id, name}]}]}. Call this first to get stable document_id values, then pass document_id explicitly on later calls so they target the right document.',
      effect: 'read',
      availability: 'default',
      tier: 'core',
      capabilities: ['document:read'],
      enabled: true
    },
    {
      name: 'save_file',
      description:
        'Save the current document to a .fig file. Returns {saved: true, path?}. An optional path must stay inside the configured MCP root.',
      effect: 'write',
      availability: 'default',
      tier: 'core',
      capabilities: ['document:read', 'filesystem:write'],
      enabled: true
    },
    ...(filesystemEnabled
      ? [
          {
            name: 'open_file',
            description:
              'Open a .fig or .pen design file from inside the configured MCP root. Returns {opened: true, target?}. The opened document becomes the active document.',
            effect: 'write',
            availability: 'filesystem',
            tier: 'core',
            capabilities: ['filesystem:read', 'document:write'],
            enabled: true
          } satisfies ToolDescriptor,
          {
            name: 'new_document',
            description:
              'Create a new empty document with a blank canvas. Returns {created: true, target?}. Optionally provide a save path inside the configured MCP root.',
            effect: 'write',
            availability: 'filesystem',
            tier: 'core',
            capabilities: ['document:write', 'filesystem:write'],
            enabled: true
          } satisfies ToolDescriptor
        ]
      : []),
    {
      name: 'close_file',
      description: 'Close an open document tab, prompting to save unsaved changes.',
      effect: 'read',
      availability: 'default',
      capabilities: ['document:read'],
      enabled: true
    },
    {
      name: 'get_codegen_prompt',
      description:
        'Get design-to-code generation guidelines. Call before generating frontend code from a design.',
      effect: 'read',
      availability: 'default',
      tier: 'extended',
      capabilities: [],
      enabled: true
    },
    {
      name: 'get_design_prompt',
      description:
        'Get the design workflow recipe — a concise guide to reading, creating, modifying, and exporting designs with OpenPencil tools. Call this first if you are unfamiliar with the available tools.',
      effect: 'read',
      availability: 'default',
      tier: 'core',
      capabilities: [],
      enabled: true
    }
  )
  return descriptors
}
