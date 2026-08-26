import { describe, expect, test } from 'bun:test'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { registerTools } from '#mcp/server'
import type { RPCSender } from '#mcp/server'

/**
 * Bridge-level harness. It stands in for the editor side of the WebSocket and
 * reproduces the two behaviours this suite is about:
 *   - `resolveAutomationTarget`'s fallback to the focused document when no
 *     `document_id` is supplied
 *   - `handlers.ts`'s `responseWithTarget`, which stamps the resolved target
 *     onto every response
 * It is deliberately NOT a real editor: it proves the bridge forwards and
 * surfaces the target, not that the desktop app resolves it correctly.
 */
function createMockEditor() {
  const documents = [
    { id: 'doc-1', name: 'First', pageId: 'page-1', pageName: 'Page 1' },
    { id: 'doc-2', name: 'Second', pageId: 'page-2', pageName: 'Page 2' }
  ]
  let activeId = 'doc-1'

  const sendRPC: RPCSender = async (body) => {
    const args = (body.args ?? {}) as { document_id?: string; name?: string }
    const requestedId = typeof args.document_id === 'string' ? args.document_id : undefined
    const doc = documents.find((d) => d.id === (requestedId ?? activeId))
    if (!doc) return { ok: false, error: `Document "${requestedId}" not found` }
    return {
      ok: true,
      result: { applied: true },
      target: {
        documentId: doc.id,
        documentName: doc.name,
        pageId: doc.pageId,
        pageName: doc.pageName
      }
    }
  }

  return {
    sendRPC,
    focus: (id: string) => {
      activeId = id
    }
  }
}

async function connect(sendRPC: RPCSender) {
  const server = new McpServer({ name: 'open-pencil-test', version: '0.0.0' })
  registerTools(server, {
    policy: { allowEval: false, disabledTools: [] },
    mcpRoot: null,
    sendRPC
  })
  const client = new Client({ name: 'target-echo-test', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, close: () => Promise.all([client.close(), server.close()]) }
}

type ResolvedTarget = {
  documentId: string
  documentName: string
  pageId?: string
  pageName?: string
}

type ToolPayload = {
  target?: ResolvedTarget
  error?: string
  code?: string
}

function parseText(content: unknown): ToolPayload {
  const blocks = content as Array<{ type: string; text?: string }>
  const first = blocks.find((block) => block.type === 'text')
  if (!first?.text) throw new Error('Expected a text content block')
  return JSON.parse(first.text) as ToolPayload
}

function expectTarget(payload: ToolPayload): ResolvedTarget {
  if (!payload.target) throw new Error('Expected a resolved target on the result')
  return payload.target
}

describe('MCP resolved-target echo', () => {
  test('an untargeted call reports the document it actually landed on', async () => {
    const editor = createMockEditor()
    const { client, close } = await connect(editor.sendRPC)
    try {
      const result = await client.callTool({ name: 'get_page_tree', arguments: {} })
      expect(result.isError).not.toBe(true)
      const target = expectTarget(parseText(result.content))
      expect(target.documentId).toBe('doc-1')
      expect(target.documentName).toBe('First')
    } finally {
      await close()
    }
  })

  test('the echoed target follows the focused document when it changes mid-session', async () => {
    const editor = createMockEditor()
    const { client, close } = await connect(editor.sendRPC)
    try {
      const before = await client.callTool({ name: 'get_page_tree', arguments: {} })
      expect(expectTarget(parseText(before.content)).documentId).toBe('doc-1')

      // The user tabs to another document while the agent session is in flight.
      editor.focus('doc-2')

      const after = await client.callTool({ name: 'get_page_tree', arguments: {} })
      const target = expectTarget(parseText(after.content))
      // The call still succeeds and still lands on the focused document — the
      // point of the echo is that the drift is now visible to the caller.
      expect(target.documentId).toBe('doc-2')
      expect(target.documentName).toBe('Second')
    } finally {
      await close()
    }
  })

  test('an explicit document_id pins the target regardless of focus', async () => {
    const editor = createMockEditor()
    const { client, close } = await connect(editor.sendRPC)
    try {
      editor.focus('doc-2')
      const result = await client.callTool({
        name: 'get_page_tree',
        arguments: { document_id: 'doc-1' }
      })
      expect(expectTarget(parseText(result.content)).documentId).toBe('doc-1')
    } finally {
      await close()
    }
  })

  test('a missing document fails with the document_not_found code', async () => {
    const editor = createMockEditor()
    const { client, close } = await connect(editor.sendRPC)
    try {
      const result = await client.callTool({
        name: 'get_page_tree',
        arguments: { document_id: 'doc-missing' }
      })
      expect(result.isError).toBe(true)
      const data = parseText(result.content)
      expect(data.code).toBe('document_not_found')
      expect(String(data.error)).toContain('doc-missing')
    } finally {
      await close()
    }
  })

  test('an unrecognised editor-side failure is classed as a tool error', async () => {
    const sendRPC: RPCSender = async () => ({ ok: false, error: 'Node "abc" has no fill' })
    const { client, close } = await connect(sendRPC)
    try {
      const result = await client.callTool({ name: 'get_page_tree', arguments: {} })
      expect(result.isError).toBe(true)
      expect(parseText(result.content).code).toBe('tool_error')
    } finally {
      await close()
    }
  })
})
