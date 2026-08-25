import type { UIMessageChunk } from 'ai'

export interface CodexEvent {
  type: string
  [key: string]: unknown
}

export interface CodexMapResult {
  chunks: UIMessageChunk[]
  textStarted: boolean
}

interface CodexEventData {
  type?: unknown
  id?: unknown
  name?: unknown
  tool?: unknown
  text?: unknown
  input?: unknown
  output?: unknown
  error?: unknown
}

const TEXT_EVENT_TYPES = new Set(['message', 'agent_message'])
const TOOL_CALL_EVENT_TYPES = new Set(['mcp_tool_call', 'tool_call', 'function_call'])
const TOOL_RESULT_EVENT_TYPES = new Set(['mcp_tool_result', 'tool_result', 'function_call_output'])

export function parseCodexJsonl(chunk: string, remainder = '', isFinal = false): {
  events: CodexEvent[]
  remainder: string
} {
  const lines = `${remainder}${chunk}`.split(/\r?\n/)
  const nextRemainder = isFinal ? '' : (lines.pop() ?? '')
  if (isFinal && lines[lines.length - 1] === '') lines.pop()
  const events: CodexEvent[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const value: unknown = JSON.parse(line)
      if (isCodexEvent(value)) events.push(value)
    } catch (error) {
      // A partial line is retained only as the final remainder; malformed complete lines are ignored.
      console.warn('[Codex] Ignoring malformed JSONL event:', error instanceof Error ? error.message : 'parse failure')
    }
  }
  return { events, remainder: nextRemainder }
}

function isCodexEvent(value: unknown): value is CodexEvent {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function mapCodexEvent(
  event: CodexEvent,
  textId: string,
  textStarted: boolean
): CodexMapResult {
  const source = eventItem(event) ?? event
  const eventType = text(source.type) ?? event.type
  if (TEXT_EVENT_TYPES.has(eventType)) return mapTextEvent(source, textId, textStarted)
  if (TOOL_CALL_EVENT_TYPES.has(eventType)) return { chunks: mapToolCall(source), textStarted }
  if (TOOL_RESULT_EVENT_TYPES.has(eventType)) return { chunks: mapToolResult(source), textStarted }
  if (event.type === 'error' || event.type === 'turn.failed') {
    return { chunks: [{ type: 'error', errorText: text(event.message) ?? 'Codex turn failed.' }], textStarted }
  }
  return { chunks: [], textStarted }
}

function mapTextEvent(source: CodexEventData, textId: string, textStarted: boolean): CodexMapResult {
  const value = text(source.text)
  if (!value) return { chunks: [], textStarted }
  const chunks: UIMessageChunk[] = []
  if (!textStarted) chunks.push({ type: 'text-start', id: textId })
  chunks.push({ type: 'text-delta', id: textId, delta: value })
  return { chunks, textStarted: true }
}

function mapToolCall(source: CodexEventData): UIMessageChunk[] {
  const toolCallId = text(source.id) ?? `codex-tool-${Date.now()}`
  const toolName = text(source.name) ?? text(source.tool) ?? 'unknown'
  const chunks: UIMessageChunk[] = [{ type: 'tool-input-start', toolCallId, toolName, providerExecuted: true, title: toolName }]
  if (source.input !== undefined) {
    chunks.push({ type: 'tool-input-available', toolCallId, toolName, input: source.input, providerExecuted: true, title: toolName })
  }
  return chunks
}

function mapToolResult(source: CodexEventData): UIMessageChunk[] {
  const toolCallId = text(source.id) ?? 'unknown'
  if (source.error !== undefined) {
    return [{ type: 'tool-output-error', toolCallId, errorText: text(source.error) ?? 'Tool call failed', providerExecuted: true }]
  }
  return [{ type: 'tool-output-available', toolCallId, output: source.output ?? null, providerExecuted: true }]
}

function eventItem(event: CodexEvent): CodexEventData | null {
  if (!event.type.startsWith('item.')) return null
  const item = event.item
  return isCodexEventData(item) ? item : null
}

function isCodexEventData(value: unknown): value is CodexEventData {
  return typeof value === 'object' && value !== null
}
