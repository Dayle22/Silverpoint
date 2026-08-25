import { promiseTimeout } from '@vueuse/core'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { randomHex } from '@open-pencil/core/random'

import { decodeTauriStderr } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'

interface AutomationHealth {
  status: 'ok' | 'no_app'
  version?: string
  installCommand?: string
  authRequired?: boolean
}

export interface AutomationServerHandle {
  disconnect: () => void
  authToken: string | null
}

const DEV_AUTOMATION_AUTH_TOKEN =
  import.meta.env.DEV && typeof __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__ === 'string'
    ? __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__
    : null
const MCP_VERSION =
  typeof __OPENPENCIL_MCP_VERSION__ === 'string' ? __OPENPENCIL_MCP_VERSION__ : '0.0.0-test'
const noop = () => undefined

let runtimeAutomationAuthToken: string | null = DEV_AUTOMATION_AUTH_TOKEN

async function readHealth(): Promise<AutomationHealth | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${AUTOMATION_HTTP_PORT}/health`, {
      signal: AbortSignal.timeout(1000)
    })
    if (!res.ok) return null
    return (await res.json()) as AutomationHealth
  } catch (e) {
    console.error('[MCP] health check failed:', e instanceof Error ? e.message : e)
    return null
  }
}

function assertCompatibleMcpVersion(health: AutomationHealth): void {
  if (health.version === MCP_VERSION) return
  const runningVersion = health.version ? `v${health.version}` : 'an older version'
  const updateHint = health.installCommand
    ? 'Restart Silverpoint to restore its bundled MCP sidecar.'
    : 'Restart Silverpoint to restore its bundled MCP sidecar.'
  throw new Error(
    `Silverpoint requires bundled MCP v${MCP_VERSION}, ` +
      `but the running MCP server is ${runningVersion}. ${updateHint}`
  )
}

async function pollHealth(retries: number, delayMs: number): Promise<AutomationHealth | null> {
  for (let i = 0; i < retries; i++) {
    await promiseTimeout(delayMs)
    const health = await readHealth()
    if (health) return health
  }
  return null
}

export async function getAutomationAuthToken(): Promise<string | null> {
  if (runtimeAutomationAuthToken) return runtimeAutomationAuthToken
  const health = await readHealth()
  if (health) assertCompatibleMcpVersion(health)
  return null
}

export async function spawnMCPIfNeeded(): Promise<AutomationServerHandle | null> {
  if (import.meta.env.DEV || !isTauri()) {
    return DEV_AUTOMATION_AUTH_TOKEN
      ? { disconnect: noop, authToken: DEV_AUTOMATION_AUTH_TOKEN }
      : null
  }

  const existing = await readHealth()
  if (existing) {
    assertCompatibleMcpVersion(existing)
    if (!runtimeAutomationAuthToken) {
      throw new Error(
        'Another Silverpoint instance or stale MCP sidecar is already using the automation port.'
      )
    }
    return {
      disconnect: noop,
      authToken: runtimeAutomationAuthToken
    }
  }

  const authToken = randomHex(32)
  runtimeAutomationAuthToken = authToken

  const { Command } = await import('@tauri-apps/plugin-shell')
  const { getAIWorkspace } = await import('@/app/ai/codex/workspace')
  const command = Command.sidecar('binaries/silverpoint-mcp', [], {
    env: {
      OPENPENCIL_MCP_AUTH_TOKEN: authToken,
      OPENPENCIL_MCP_CORS_ORIGIN: window.location.origin,
      OPENPENCIL_MCP_ROOT: await getAIWorkspace()
    }
  })

  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    console.error('[MCP]', decodeTauriStderr(raw))
  })

  command.on('close', (data: { code: number | null }) => {
    console.error(`[MCP] Server exited (code ${data.code ?? 'null'})`)
  })

  const child = await command.spawn()
  const health = await pollHealth(5, 1000)

  if (health) {
    assertCompatibleMcpVersion(health)
    runtimeAutomationAuthToken = authToken
    return {
      disconnect: () => {
        void child.kill()
      },
      authToken: runtimeAutomationAuthToken
    }
  }

  await child.kill()
  throw new Error(
    'Failed to start the bundled MCP server. Restart Silverpoint and try again.'
  )
}
