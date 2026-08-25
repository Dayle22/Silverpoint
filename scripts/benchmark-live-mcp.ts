import { performance } from 'node:perf_hooks'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const RUNS = 5
const READY_TIMEOUT_MS = 10_000

type ToolResult = {
  content?: Array<{ type?: string; text?: string }>
  isError?: boolean
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function summary(values: number[]) {
  return {
    runs_ms: values.map((value) => Number(value.toFixed(1))),
    median_ms: Number(median(values).toFixed(1)),
    min_ms: Number(Math.min(...values).toFixed(1)),
    max_ms: Number(Math.max(...values).toFixed(1))
  }
}

function textResult(result: ToolResult): unknown {
  if (result.isError) throw new Error('MCP tool returned an error')
  const text = result.content?.find((item) => item.type === 'text')?.text
  if (!text) throw new Error('MCP tool returned no text content')
  return JSON.parse(text)
}

async function waitForLiveApp(client: Client): Promise<{
  documents: Array<{ id: string; active?: boolean; current_page_id: string }>
}> {
  const deadline = performance.now() + READY_TIMEOUT_MS
  let lastError: unknown
  while (performance.now() < deadline) {
    try {
      return textResult(
        (await client.callTool({ name: 'list_documents', arguments: {} })) as ToolResult
      ) as { documents: Array<{ id: string; active?: boolean; current_page_id: string }> }
    } catch (error) {
      lastError = error
      await Bun.sleep(100)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Live Silverpoint MCP did not become ready')
}

async function timed<T>(operation: () => Promise<T>): Promise<{ elapsed: number; value: T }> {
  const started = performance.now()
  const value = await operation()
  return { elapsed: performance.now() - started, value }
}

const transport = new StdioClientTransport({
  command: 'bun',
  args: ['packages/mcp/src/stdio.ts'],
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    WS_PORT: '7601',
    PATH: process.env.PATH ?? ''
  },
  stderr: 'pipe'
})
const client = new Client({ name: 'silverpoint-live-benchmark', version: '1.0.0' })

try {
  const processStarted = performance.now()
  await client.connect(transport)
  const connectedMs = performance.now() - processStarted
  const documents = await waitForLiveApp(client)
  const readyMs = performance.now() - processStarted
  const activeDocument = documents.documents.find((document) => document.active) ?? documents.documents[0]
  if (!activeDocument) throw new Error('Silverpoint has no open document')

  const toolsResult = await timed(() => client.listTools())
  const toolSchemaBytes = Buffer.byteLength(JSON.stringify(toolsResult.value.tools), 'utf8')

  const listDocumentRuns: number[] = []
  for (let index = 0; index < RUNS; index += 1) {
    const result = await timed(() => client.callTool({ name: 'list_documents', arguments: {} }))
    textResult(result.value as ToolResult)
    listDocumentRuns.push(result.elapsed)
  }

  const selectionRuns: number[] = []
  for (let index = 0; index < RUNS; index += 1) {
    const result = await timed(() =>
      client.callTool({
        name: 'get_selection',
        arguments: {
          document_id: activeDocument.id,
          page_id: activeDocument.current_page_id
        }
      })
    )
    textResult(result.value as ToolResult)
    selectionRuns.push(result.elapsed)
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        route: 'live installed app via local stdio-to-WebSocket MCP bridge',
        read_only: true,
        runs: RUNS,
        connection: {
          mcp_client_connect_ms: Number(connectedMs.toFixed(1)),
          live_app_ready_ms: Number(readyMs.toFixed(1))
        },
        tools: {
          count: toolsResult.value.tools.length,
          schema_bytes: toolSchemaBytes,
          list_ms: Number(toolsResult.elapsed.toFixed(1))
        },
        list_documents: summary(listDocumentRuns),
        get_selection: summary(selectionRuns)
      },
      null,
      2
    )}\n`
  )
} finally {
  await client.close()
}
