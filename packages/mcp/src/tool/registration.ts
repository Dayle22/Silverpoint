import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'

import type { McpServer, ToolCallback, ToolAnnotations } from '@modelcontextprotocol/server'
// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toStandardJsonSchema as toStandardJSONSchema } from '@valibot/to-json-schema'
import * as v from 'valibot'

import { CODEGEN_PROMPT, DESIGN_WORKFLOW_PROMPT } from '@open-pencil/core/tools'

import type { RPCJSONObject } from '#mcp/json'
import type { MCPResult } from '#mcp/result'
import { MAX_RESULT_BYTES, classifyError, fail, ok, resultTooLargeMessage } from '#mcp/result'
import { createToolDescriptors, getMCPToolDefinitions } from '#mcp/tool/manifest'
import type { ToolDescriptor, ToolEffect, ToolPolicy } from '#mcp/tool/metadata'
import { resolveSafePath, writeToolOutput } from '#mcp/tool/output'
import { isToolEnabled } from '#mcp/tool/policy'

export type RPCSender = (body: Record<string, unknown>) => Promise<unknown>

const automationTargetSchema = {
  document_id: v.optional(
    v.pipe(v.string(), v.description('Optional OpenPencil document/tab ID to target'))
  ),
  page_id: v.optional(
    v.pipe(v.string(), v.description('Optional page ID to target within the document'))
  )
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
  const target: { document_id?: string; page_id?: string } = {}
  if (typeof document_id === 'string') target.document_id = document_id
  if (typeof page_id === 'string') target.page_id = page_id
  return { target, args: rest }
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
  const register = <InputArgs extends v.GenericSchema>(
    name: string,
    toolOptions: { description: string; inputSchema: InputArgs },
    handler: ToolCallback<ReturnType<typeof toStandardJSONSchema<InputArgs>>>
  ) => {
    const descriptor = descriptors.get(name)
    if (!descriptor) throw new Error(`Missing MCP tool descriptor for "${name}"`)
    if (!isToolEnabled(descriptor, policy)) return
    mcpServer.registerTool(
      name,
      {
        ...toolOptions,
        inputSchema: toStandardJSONSchema(toolOptions.inputSchema),
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
      inputSchema: v.object({
        tier: v.optional(v.picklist(['core', 'extended', 'advanced'])),
        effect: v.optional(v.picklist(['read', 'write']))
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

  for (const def of getMCPToolDefinitions()) {
    register(
      def.name,
      {
        description: def.description,
        inputSchema: v.object({ ...def.input.entries, ...automationTargetSchema })
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
        'List open OpenPencil documents/tabs with their IDs, file paths, current pages, and pages.',
      inputSchema: v.object({})
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
        ? v.object({
            path: v.optional(
              v.pipe(
                v.string(),
                v.minLength(1),
                v.description('Path for the .fig file, absolute or relative to the MCP root')
              )
            ),
            ...automationTargetSchema
          })
        : v.object({ ...automationTargetSchema })
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
        const response: { saved: true; path?: string; target?: unknown } = { saved: true }
        if (safePath) response.path = safePath.resolved
        if (res.target) response.target = res.target
        return ok(
          response,
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
        description: 'Open a .fig or .pen file from inside the configured MCP root.',
        inputSchema: v.object({
          path: v.pipe(
            v.string(),
            v.minLength(1),
            v.description('Path to the design file, absolute or relative to the MCP root')
          ),
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
            { opened: true, target: res.target },
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
          'Create a new empty document with an optional save path inside the configured MCP root.',
        inputSchema: v.object({
          path: v.optional(
            v.pipe(
              v.string(),
              v.minLength(1),
              v.description('Path for the new file, absolute or relative to the MCP root')
            )
          ),
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
            { created: true, target: res.target },
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
    'close_file',
    {
      description: 'Close an open document tab, prompting to save unsaved changes.',
      inputSchema: v.object({ ...automationTargetSchema })
    },
    async (args: { document_id?: string; page_id?: string }) => {
      try {
        const { target } = splitAutomationTarget(args)
        const result = await sendRPC({ command: 'close_file', args: target })
        const res = result as {
          ok?: boolean
          result?: { closed?: boolean }
          target?: unknown
          error?: string
        }
        if (res.ok === false) return fail(new Error(res.error))
        const response: { closed: boolean; target?: unknown } = {
          closed: res.result?.closed === true
        }
        if (res.target) response.target = res.target
        return ok(response)
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'get_codegen_prompt',
    {
      description:
        'Get design-to-code generation guidelines. Call before generating frontend code.',
      inputSchema: v.object({})
    },
    async () => ok({ prompt: CODEGEN_PROMPT })
  )

  register(
    'get_design_prompt',
    {
      description:
        'Get the design workflow recipe — a concise guide to reading, creating, modifying, and exporting designs with OpenPencil tools. Call this first if you are unfamiliar with the available tools or need a step-by-step plan for a design task.',
      inputSchema: v.object({})
    },
    async () => ok({ prompt: DESIGN_WORKFLOW_PROMPT })
  )
}
