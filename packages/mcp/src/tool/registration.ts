import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'

import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { ALL_TOOLS, CODEGEN_PROMPT, DESIGN_WORKFLOW_PROMPT } from '@open-pencil/core/tools'

import type { RPCJSONObject } from '#mcp/json'
import type { MCPResult } from '#mcp/result'
import { MAX_RESULT_BYTES, classifyError, fail, ok, resultTooLargeMessage } from '#mcp/result'
import { createToolDescriptors } from '#mcp/tool/manifest'
import type { ToolDescriptor, ToolEffect, ToolPolicy } from '#mcp/tool/metadata'
import { resolveSafePath, writeToolOutput } from '#mcp/tool/output'
import { isToolEnabled } from '#mcp/tool/policy'
import { paramToZod } from '#mcp/tool/schema'

export type RPCSender = (body: Record<string, unknown>) => Promise<unknown>

const automationTargetSchema = {
  document_id: z
    .string()
    .describe(
      'OpenPencil document/tab ID to target. If omitted, the call targets whichever document is focused in the app at the moment it arrives, which can change between calls. Call list_documents for stable IDs and pass this explicitly whenever more than one document is open. Every result echoes the document it acted on.'
    )
    .optional(),
  page_id: z
    .string()
    .describe(
      'Page ID to target within the document. If omitted, the document current page is used.'
    )
    .optional()
}

/**
 * Errors raised inside the editor arrive here as plain strings, so the message is
 * the only classification signal. Anything unrecognised is a tool-level failure
 * rather than genuinely unknown, since it came back over a working RPC channel.
 */
function failFromRPC(message: string | undefined): MCPResult {
  const msg = message ?? 'Tool call failed'
  const code = classifyError(msg)
  return fail(new Error(msg), code === 'unknown' ? 'tool_error' : code)
}

/**
 * Appends the resolved automation target to a result that is not a plain JSON
 * object (an image, or a file-write receipt) as an extra text block.
 */
function appendTarget(result: MCPResult, target: unknown): MCPResult {
  if (!target) return result
  return {
    ...result,
    content: [...result.content, { type: 'text', text: JSON.stringify({ target }, null, 2) }]
  }
}

function splitAutomationTarget(args: Record<string, unknown>): {
  target: { document_id?: string; page_id?: string }
  args: Record<string, unknown>
} {
  const { document_id, page_id, ...rest } = args
  return {
    target: {
      ...(typeof document_id === 'string' ? { document_id } : {}),
      ...(typeof page_id === 'string' ? { page_id } : {})
    },
    args: rest
  }
}

export interface RegisterToolsOptions {
  policy: ToolPolicy
  mcpRoot?: string | null
  sendRPC: RPCSender
}

function toolAnnotations(effect: ToolEffect): ToolAnnotations {
  return {
    readOnlyHint: effect === 'read',
    destructiveHint: effect === 'write'
  }
}

function descriptorByName(descriptors: readonly ToolDescriptor[]): Map<string, ToolDescriptor> {
  return new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]))
}

export function registerTools(mcpServer: McpServer, options: RegisterToolsOptions): void {
  const { policy, sendRPC } = options
  const resolvedRoot = options.mcpRoot ? resolve(options.mcpRoot) : null
  const descriptors = descriptorByName(createToolDescriptors(resolvedRoot !== null))
  const register = <InputArgs extends z.ZodObject>(
    name: string,
    toolOptions: { description: string; inputSchema: InputArgs },
    handler: ToolCallback<InputArgs>
  ) => {
    const descriptor = descriptors.get(name)
    if (!descriptor) throw new Error(`Missing MCP tool descriptor for "${name}"`)
    if (!isToolEnabled(descriptor, policy)) return
    mcpServer.registerTool(
      name,
      {
        ...toolOptions,
        annotations: toolAnnotations(descriptor.effect),
        _meta: {
          'openpencil/capabilities': descriptor.capabilities,
          ...(descriptor.tier ? { 'openpencil/tier': descriptor.tier } : {})
        }
      },
      handler
    )
  }

  register(
    'list_tools',
    {
      description:
        'List available OpenPencil tools with their descriptions, tiers (core/extended/advanced), and effects (read/write). Filter by tier or effect to discover tools without loading all schemas.',
      inputSchema: z.object({
        tier: z
          .enum(['core', 'extended', 'advanced'])
          .describe('Filter by tool tier (core = essential ~25 tools, extended = full set, advanced = eval)')
          .optional(),
        effect: z
          .enum(['read', 'write'])
          .describe('Filter by effect (read = non-mutating inspections, write = mutations)')
          .optional()
      })
    },
    async (args: { tier?: 'core' | 'extended' | 'advanced'; effect?: 'read' | 'write' }) => {
      const list = createToolDescriptors(resolvedRoot !== null)
        .filter((d) => isToolEnabled(d, policy))
        .filter((d) => (args.tier ? d.tier === args.tier : true))
        .filter((d) => (args.effect ? d.effect === args.effect : true))
        .map((d) => ({
          name: d.name,
          description: d.description,
          effect: d.effect,
          tier: d.tier ?? 'extended',
          capabilities: d.capabilities
        }))
      return ok({ count: list.length, tools: list })
    }
  )

  for (const def of ALL_TOOLS) {
    const shape: Record<string, z.ZodType> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToZod(param)
    }
    register(
      def.name,
      {
        description: def.description,
        inputSchema: z.object({ ...shape, ...automationTargetSchema })
      },
      async (args: Record<string, unknown>) => {
        try {
          const { target, args: toolArgs } = splitAutomationTarget(args)
          const result = await sendRPC({
            command: 'tool',
            args: { ...target, name: def.name, args: toolArgs }
          })
          const res = result as {
            ok?: boolean
            result?: unknown
            target?: unknown
            error?: string
          }
          if (res.ok === false) return failFromRPC(res.error)
          const r = res.result as RPCJSONObject | undefined
          const filePath = typeof toolArgs.path === 'string' ? toolArgs.path : null
          if (r && filePath && resolvedRoot) {
            const written = await writeToolOutput(def.name, r, filePath, resolvedRoot)
            if (written) return appendTarget(written, res.target)
          }
          if (r && 'base64' in r && 'mimeType' in r) {
            const base64 = String(r.base64)
            const bytes = Buffer.byteLength(base64, 'utf8')
            if (bytes > MAX_RESULT_BYTES) {
              return fail(
                new Error(
                  resultTooLargeMessage(
                    `Image from "${def.name}"`,
                    bytes,
                    'Export a smaller region or lower the scale/resolution.'
                  )
                )
              )
            }
            return appendTarget(
              {
                content: [
                  {
                    type: 'image' as const,
                    data: base64,
                    mimeType: r.mimeType as string
                  }
                ]
              },
              res.target
            )
          }
          if (res.target) return ok({ ...r, target: res.target }, def.name)
          return ok(r, def.name)
        } catch (e) {
          return fail(e)
        }
      }
    )
  }

  register(
    'list_documents',
    {
      description:
        'List all open OpenPencil documents/tabs. Returns {documents: [{id, name, path, currentPage, pages: [{id, name}]}]}. Call this first to get stable document_id values, then pass document_id explicitly on later calls so they target the right document. Note: tool calls are executed one at a time over a single connection — use batch_update for bulk edits instead of many separate calls.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        const result = await sendRPC({ command: 'list_documents', args: {} })
        const res = result as { ok?: boolean; result?: unknown; error?: string }
        if (res.ok === false) return failFromRPC(res.error)
        return ok(
          res.result ?? {},
          'list_documents',
          'Pass document_id explicitly on subsequent tool calls to target a specific document.'
        )
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'save_file',
    {
      description: resolvedRoot
        ? 'Save the current document to a .fig file. Returns {saved: true, path?}. If path is provided, it must be inside the configured MCP root; otherwise uses the existing file path.'
        : 'Save the current document to a .fig file. Returns {saved: true}. Uses the existing file path if available, otherwise prompts the user for a location.',
      inputSchema: resolvedRoot
        ? z.object({
            path: z
              .string()
              .min(1)
              .describe('Path for the .fig file, absolute or relative to the MCP root')
              .optional(),
            ...automationTargetSchema
          })
        : z.object({ ...automationTargetSchema })
    },
    async (args: { path?: string; document_id?: string; page_id?: string }) => {
      try {
        const safePath =
          args.path !== undefined && resolvedRoot
            ? await resolveSafePath(args.path, resolvedRoot)
            : undefined
        const { target } = splitAutomationTarget(args)
        const result = await sendRPC({
          command: 'save_file',
          args: { ...target, path: safePath?.realPath }
        })
        const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
        if (res.ok === false) return failFromRPC(res.error)
        return ok(
          {
            saved: true,
            ...(safePath ? { path: safePath.resolved } : {}),
            ...(res.target ? { target: res.target } : {})
          },
          'save_file',
          'Document saved. Call export_svg or export_image if you need exported graphic files.'
        )
      } catch (e) {
        return fail(e)
      }
    }
  )

  if (resolvedRoot) {
    register(
      'open_file',
      {
        description: 'Open a .fig or .pen design file from inside the configured MCP root. Returns {opened: true, target?}. The opened document becomes the active document for subsequent tool calls.',
        inputSchema: z.object({
          path: z
            .string()
            .min(1)
            .describe('Path to the design file, absolute or relative to the MCP root'),
          ...automationTargetSchema
        })
      },
      async (args: { path: string; document_id?: string; page_id?: string }) => {
        try {
          const safe = await resolveSafePath(args.path, resolvedRoot)
          const { target } = splitAutomationTarget(args)
          const result = await sendRPC({
            command: 'open_file',
            args: { ...target, path: safe.realPath }
          })
          const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
          if (res.ok === false) return failFromRPC(res.error)
          return ok(
            { opened: true, ...(res.target ? { target: res.target } : {}) },
            'open_file',
            'Document opened. Call get_page_tree to view the node structure of the canvas.'
          )
        } catch (e) {
          return fail(e)
        }
      }
    )

    register(
      'new_document',
      {
        description:
          'Create a new empty document with a blank canvas. Returns {created: true, target?}. Optionally provide a save path inside the configured MCP root. The new document becomes the active document.',
        inputSchema: z.object({
          path: z
            .string()
            .min(1)
            .describe('Path for the new file, absolute or relative to the MCP root')
            .optional(),
          ...automationTargetSchema
        })
      },
      async (args: { path?: string; document_id?: string; page_id?: string }) => {
        try {
          const safePath =
            args.path !== undefined ? await resolveSafePath(args.path, resolvedRoot) : undefined
          const { target } = splitAutomationTarget(args)
          const result = await sendRPC({
            command: 'new_document',
            args: { ...target, path: safePath?.realPath }
          })
          const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
          if (res.ok === false) return failFromRPC(res.error)
          return ok(
            { created: true, ...(res.target ? { target: res.target } : {}) },
            'new_document',
            'Blank document created. Call render or create_shape to start designing.'
          )
        } catch (e) {
          return fail(e)
        }
      }
    )
  }

  register(
    'get_codegen_prompt',
    {
      description:
        'Get design-to-code generation guidelines. Call before generating frontend code from a design. Returns a prompt with step-by-step workflow, token extraction rules, and framework-specific patterns (React, Vue, Svelte, HTML).',
      inputSchema: z.object({})
    },
    async () => ok({ prompt: CODEGEN_PROMPT })
  )

  register(
    'get_design_prompt',
    {
      description:
        'Get the design workflow recipe — a concise guide to reading, creating, modifying, and exporting designs with OpenPencil tools. Call this first if you are unfamiliar with the available tools or need a step-by-step plan for a design task.',
      inputSchema: z.object({})
    },
    async () => ok({ prompt: DESIGN_WORKFLOW_PROMPT })
  )
}
