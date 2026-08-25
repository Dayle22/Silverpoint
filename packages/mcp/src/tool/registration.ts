import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { ALL_TOOLS, CODEGEN_PROMPT } from '@open-pencil/core/tools'

import type { RpcJsonObject } from '#mcp/json'
import type { MCPResult } from '#mcp/result'
import { MAX_RESULT_BYTES, classifyError, fail, ok, resultTooLargeMessage } from '#mcp/result'

import { resolveSafePath, writeToolOutput } from './output'
import { paramToZod } from './schema'

export type RpcSender = (body: Record<string, unknown>) => Promise<unknown>

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
function failFromRpc(message: string | undefined): MCPResult {
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
  enableEval: boolean
  mcpRoot?: string | null
  sendRpc: RpcSender
}

export function registerTools(mcpServer: McpServer, options: RegisterToolsOptions) {
  const { enableEval, sendRpc } = options
  const resolvedRoot = options.mcpRoot ? resolve(options.mcpRoot) : null
  const register = mcpServer.registerTool.bind(mcpServer) as (...a: unknown[]) => void

  for (const def of ALL_TOOLS) {
    if ((!enableEval && def.name === 'eval') || def.name === 'stock_photo') continue
    const shape: Record<string, z.ZodType> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToZod(param)
    }
    register(
      def.name,
      {
        description: def.description,
        inputSchema: z.object({ ...shape, ...automationTargetSchema }),
        annotations: {
          readOnlyHint: !def.mutates,
          destructiveHint: Boolean(def.mutates),
          openWorldHint: false
        }
      },
      async (args: Record<string, unknown>) => {
        try {
          const { target, args: toolArgs } = splitAutomationTarget(args)
          const result = await sendRpc({
            command: 'tool',
            args: { ...target, name: def.name, args: toolArgs }
          })
          const res = result as {
            ok?: boolean
            result?: unknown
            target?: unknown
            error?: string
          }
          if (res.ok === false) return failFromRpc(res.error)
          const r = res.result as RpcJsonObject | undefined
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
        'List open OpenPencil documents/tabs with their IDs, file paths, current pages, and pages. Call this first to get stable document IDs, then pass document_id explicitly on later calls. Note: tool calls are executed one at a time over a single connection to the app, so issuing calls concurrently queues them rather than running them in parallel — use batch_update for bulk edits instead of many separate calls.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => {
      try {
        const result = await sendRpc({ command: 'list_documents', args: {} })
        const res = result as { ok?: boolean; result?: unknown; error?: string }
        if (res.ok === false) return failFromRpc(res.error)
        return ok(res.result ?? {})
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'save_file',
    {
      description: resolvedRoot
        ? `Save the current document to disk. If path is provided, it must be inside ${resolvedRoot}.`
        : 'Save the current document to disk. Uses the existing file path if available, otherwise prompts for a location.',
      inputSchema: resolvedRoot
        ? z.object({
            path: z.string().describe('Optional absolute path for the .fig file').optional(),
            ...automationTargetSchema
          })
        : z.object({ ...automationTargetSchema }),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
    },
    async (args: { path?: string; document_id?: string; page_id?: string }) => {
      try {
        const safePath =
          args.path && resolvedRoot ? resolveSafePath(args.path, resolvedRoot) : undefined
        const { target } = splitAutomationTarget(args)
        const result = await sendRpc({ command: 'save_file', args: { ...target, path: safePath } })
        const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
        if (res.ok === false) return failFromRpc(res.error)
        return ok({
          saved: true,
          ...(safePath ? { path: safePath } : {}),
          ...(res.target ? { target: res.target } : {})
        })
      } catch (e) {
        return fail(e)
      }
    }
  )

  if (resolvedRoot) {
    register(
      'open_file',
      {
        description: `Open a .fig or .pen file from disk into a new tab. Path must be inside ${resolvedRoot}.`,
        inputSchema: z.object({
          path: z.string().describe('Absolute path to the design file'),
          ...automationTargetSchema
        }),
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
      },
      async (args: { path: string; document_id?: string; page_id?: string }) => {
        try {
          const safe = resolveSafePath(args.path, resolvedRoot)
          const { target } = splitAutomationTarget(args)
          const result = await sendRpc({ command: 'open_file', args: { ...target, path: safe } })
          const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
          if (res.ok === false) return failFromRpc(res.error)
          return ok({ opened: true, ...(res.target ? { target: res.target } : {}) })
        } catch (e) {
          return fail(e)
        }
      }
    )

    register(
      'new_document',
      {
        description: `Create a new empty document. Optionally set a save path inside ${resolvedRoot}.`,
        inputSchema: z.object({
          path: z.string().describe('Optional absolute path for the new file').optional(),
          ...automationTargetSchema
        }),
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
      },
      async (args: { path?: string; document_id?: string; page_id?: string }) => {
        try {
          const safePath = args.path ? resolveSafePath(args.path, resolvedRoot) : undefined
          const { target } = splitAutomationTarget(args)
          const result = await sendRpc({
            command: 'new_document',
            args: { ...target, path: safePath }
          })
          const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
          if (res.ok === false) return failFromRpc(res.error)
          return ok({ created: true, ...(res.target ? { target: res.target } : {}) })
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
        'Get design-to-code generation guidelines. Call before generating frontend code.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => ok({ prompt: CODEGEN_PROMPT })
  )
}
