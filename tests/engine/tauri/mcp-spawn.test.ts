import { afterEach, describe, expect, test, vi } from 'bun:test'

import { spawnMCPIfNeeded } from '@/app/automation/mcp/spawn'

import { clearTauriMocks, installTauriMockWindow, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'navigator')
  Reflect.deleteProperty(globalThis, 'location')
})

describe('Tauri MCP spawning', () => {
  test('rejects an existing sidecar whose bearer token is not owned by this app process', async () => {
    installTauriMockWindow()
    Object.assign(globalThis.window, { location: { origin: 'tauri://localhost' } })
    await mockTauriIPC(() => null)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', version: '0.0.0-test' }), { status: 200 })
    )

    await expect(spawnMCPIfNeeded()).rejects.toThrow(
      'Another Silverpoint instance or stale MCP sidecar is already using the automation port.'
    )
  })

  test('resolves the AI workspace before spawning the bundled MCP sidecar', async () => {
    installTauriMockWindow()
    Object.assign(globalThis.window, { location: { origin: 'tauri://localhost' } })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { platform: 'MacIntel' }
    })

    let healthChecks = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      healthChecks += 1
      if (healthChecks === 1) return new Response('', { status: 404 })
      return new Response(
        JSON.stringify({ status: 'ok', version: '0.0.0-test' }),
        {
          status: 200
        }
      )
    })

    let onEvent: ((event: unknown) => void) | null = null
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:path|resolve_directory') return 'C:\\Silverpoint\\AppLocalData'
      if (cmd === 'plugin:path|join') {
        return (args as { paths: string[] }).paths.join('\\')
      }
      if (cmd === 'plugin:fs|exists') return false
      if (cmd === 'plugin:shell|spawn') {
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 77
      }
      return null
    })

    const handle = await spawnMCPIfNeeded()
    onEvent?.({ event: 'Stderr', payload: [119, 97, 114, 110] })
    handle?.disconnect()
    await Promise.resolve()

    const spawn = calls.find((call) => call.cmd === 'plugin:shell|spawn')
    expect(spawn).toBeDefined()
    if (!spawn) throw new Error('Expected bundled MCP sidecar spawn call')
    expect(handle?.authToken).toBe(
      (spawn.args as { options: { env: { OPENPENCIL_MCP_AUTH_TOKEN: string } } }).options.env
        .OPENPENCIL_MCP_AUTH_TOKEN
    )
    expect(calls[0]).toEqual({
      cmd: 'plugin:path|resolve_directory',
      args: { directory: 15 }
    })
    expect(spawn.args).toMatchObject({
      program: 'binaries/silverpoint-mcp',
      args: [],
      options: {
        env: {
          OPENPENCIL_MCP_AUTH_TOKEN: expect.any(String),
          OPENPENCIL_MCP_CORS_ORIGIN: 'tauri://localhost',
          OPENPENCIL_MCP_ROOT: 'C:\\Silverpoint\\AppLocalData\\ai-workspace'
        }
      }
    })
    expect(calls.at(-1)).toEqual({ cmd: 'plugin:shell|kill', args: { cmd: 'killChild', pid: 77 } })
  })
})
