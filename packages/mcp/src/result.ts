import { Buffer } from 'node:buffer'

export type MCPContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export type MCPResult = { content: MCPContent[]; isError?: boolean }

export const MAX_RESULT_BYTES = 900_000

/**
 * Machine-readable failure classes returned alongside the human-readable message.
 * Callers should branch on `code`; `error` text is for humans and may be reworded.
 */
export const ERROR_CODES = [
  'document_not_found',
  'page_not_found',
  'no_active_document',
  'app_not_connected',
  'rpc_timeout',
  'result_too_large',
  'path_outside_root',
  'tool_error',
  'unknown'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export function resultTooLargeMessage(kind: string, bytes: number, hint: string): string {
  return `${kind} is too large (${Math.round(bytes / 1024)}KB, limit ${Math.round(
    MAX_RESULT_BYTES / 1024
  )}KB). ${hint}`
}

/**
 * Infers a failure class from an error message. Errors raised inside the editor
 * cross the RPC boundary as plain strings, so the message is the only signal
 * available on this side of the bridge.
 */
export function classifyError(message: string): ErrorCode {
  if (/^Document ".*" not found/.test(message)) return 'document_not_found'
  if (/^Page ".*" not found in document/.test(message)) return 'page_not_found'
  if (message.startsWith('No active OpenPencil document')) return 'no_active_document'
  if (message.startsWith('OpenPencil app is not connected')) return 'app_not_connected'
  if (message.startsWith('RPC timeout (')) return 'rpc_timeout'
  if (message.includes('is too large (')) return 'result_too_large'
  if (message.startsWith('Path is outside the allowed root')) return 'path_outside_root'
  return 'unknown'
}

export function ok(data: unknown, toolName?: string): MCPResult {
  const text = JSON.stringify(data, null, 2)
  const bytes = Buffer.byteLength(text, 'utf8')
  if (bytes > MAX_RESULT_BYTES) {
    return fail(
      new Error(
        resultTooLargeMessage(
          toolName ? `Result from "${toolName}"` : 'Result',
          bytes,
          'Narrow the request with depth/root_id/node_types, get_node, or find_nodes.'
        )
      )
    )
  }
  return { content: [{ type: 'text', text }] }
}

export function fail(e: unknown, code?: ErrorCode): MCPResult {
  const msg = e instanceof Error ? e.message : String(e)
  const resolved = code ?? classifyError(msg)
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: msg, code: resolved }) }],
    isError: true
  }
}
