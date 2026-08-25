import { describe, expect, test } from 'bun:test'

import { mapCodexEvent, parseCodexJsonl } from '@/app/ai/codex/events'

describe('Codex JSONL events', () => {
  test('parses split JSONL chunks and ignores blank lines', () => {
    const first = parseCodexJsonl('{"type":"message","text":"Hel')
    expect(first).toEqual({ events: [], remainder: '{"type":"message","text":"Hel' })
    expect(parseCodexJsonl('lo"}\n\n{"type":"turn.completed"}\n', first.remainder)).toEqual({
      events: [{ type: 'message', text: 'Hello' }, { type: 'turn.completed' }],
      remainder: ''
    })
  })

  test('maps an agent message into UI text chunks', () => {
    expect(mapCodexEvent({ type: 'message', text: 'Done' }, 'text-1', false)).toEqual({
      chunks: [
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Done' }
      ],
      textStarted: true
    })
  })

  test('maps a completed CLI agent-message item into UI text chunks', () => {
    expect(
      mapCodexEvent(
        { type: 'item.completed', item: { type: 'agent_message', text: 'The selected frame is 400 by 300.' } },
        'text-1',
        false
      )
    ).toEqual({
      chunks: [
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'The selected frame is 400 by 300.' }
      ],
      textStarted: true
    })
  })

  test('flushes a final JSONL event without a trailing newline', () => {
    expect(
      parseCodexJsonl(
        '',
        '{"type":"item.completed","item":{"type":"agent_message","text":"Final response"}}',
        true
      )
    ).toEqual({
      events: [{ type: 'item.completed', item: { type: 'agent_message', text: 'Final response' } }],
      remainder: ''
    })
  })

  test('maps MCP tool start and completion without leaking environment values', () => {
    const started = mapCodexEvent(
      { type: 'mcp_tool_call', id: 'call-1', name: 'set_fill', input: { colour: 'red' } },
      'text-1',
      false
    )
    const completed = mapCodexEvent(
      { type: 'mcp_tool_result', id: 'call-1', output: { ok: true } },
      'text-1',
      false
    )
    expect(started.chunks[0]).toMatchObject({ type: 'tool-input-start', toolCallId: 'call-1' })
    expect(completed.chunks[0]).toMatchObject({ type: 'tool-output-available', toolCallId: 'call-1' })
    expect(JSON.stringify([started, completed])).not.toContain('OPENPOTPOOL_MCP_AUTH_TOKEN')
  })
})
