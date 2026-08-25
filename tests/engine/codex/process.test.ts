import { describe, expect, test } from 'bun:test'

import {
  CODEX_NATIVE_EXECUTABLE,
  CODEX_SHELL_COMMAND,
  buildCodexArgs,
  codexExecutableFromHomeDirectory,
  redactCodexText
} from '@/app/ai/codex/process'

describe('Codex process contract', () => {
  test('resolves the fixed native npm executable without a shim', () => {
    expect(CODEX_NATIVE_EXECUTABLE.toLowerCase()).toMatch(/@openai[\\/]codex[\\/]node_modules/)
    expect(CODEX_NATIVE_EXECUTABLE.toLowerCase()).toMatch(/codex\.exe$/)
    expect(CODEX_NATIVE_EXECUTABLE.toLowerCase()).not.toMatch(/\.cmd$|\.ps1$/)
  })

  test('resolves Codex from the global Roaming npm installation, not app data', () => {
    expect(codexExecutableFromHomeDirectory('C:\\Users\\tester')).toBe(
      'C:\\Users\\tester\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe'
    )
  })

  test('builds the exact bounded invocation and keeps prompt out of argv', () => {
    const args = buildCodexArgs(
      'C:\\Users\\tester\\AppData\\Local\\Silverpoint\\ai-workspace',
      'private prompt'
    )
    expect(args).toEqual([
      '--ask-for-approval',
      'never',
      'exec',
      '--json',
      '--color',
      'never',
      '--skip-git-repo-check',
      '--sandbox',
      'workspace-write',
      '--ephemeral',
      '--ignore-user-config',
      '--ignore-rules',
      '--strict-config',
      '-C',
      'C:\\Users\\tester\\AppData\\Local\\Silverpoint\\ai-workspace',
      '-c',
      'sandbox_workspace_write.network_access=true',
      '-c',
      'mcp_servers.silverpoint.url="http://127.0.0.1:7600/mcp"',
      '-c',
      'mcp_servers.silverpoint.bearer_token_env_var="SILVERPOINT_MCP_AUTH_TOKEN"'
    ])
    expect(args.join(' ')).not.toContain('prompt')
    expect(args.join(' ')).not.toContain('--add-dir')
    expect(args.join(' ')).not.toContain('private prompt')
  })

  test('uses a native command that writes and closes stdin', async () => {
    const nativeCommandUrl = new URL('../../../desktop/src/codex.rs', import.meta.url)
    const nativeCommand = await Bun.file(nativeCommandUrl).text()
    expect(nativeCommand).toContain('.write_all(prompt.as_bytes())')
    expect(nativeCommand).toContain('drop(stdin)')
    expect(nativeCommand).toContain('pub fn cancel_codex_chat')
  })

  test('computes the app-local Codex workspace inside the native command', async () => {
    const nativeCommandUrl = new URL('../../../desktop/src/codex.rs', import.meta.url)
    const nativeCommand = await Bun.file(nativeCommandUrl).text()
    expect(nativeCommand).toContain('.app_local_data_dir()')
    expect(nativeCommand).toContain('.join("ai-workspace")')
  })

  test('declares the native Codex command for Tauri shell scope deserialisation', async () => {
    const capabilityUrl = new URL('../../../desktop/capabilities/default.json', import.meta.url)
    const capability = JSON.parse(await Bun.file(capabilityUrl).text()) as {
      permissions: Array<string | { identifier?: string; allow?: Array<Record<string, unknown>> }>
    }
    const shellPermission = capability.permissions.find(
      (permission): permission is { identifier: string; allow: Array<Record<string, unknown>> } =>
        typeof permission === 'object' && permission.identifier === 'shell:allow-spawn'
    )

    const codexEntries =
      shellPermission?.allow.filter((entry) => String(entry.name).startsWith('codex-')) ?? []
    expect(codexEntries.map((entry) => entry.name)).toEqual([
      CODEX_SHELL_COMMAND.version,
      CODEX_SHELL_COMMAND.loginStatus
    ])
    expect(
      codexEntries.every(
        (entry) => typeof entry.cmd === 'string' && entry.cmd.endsWith('codex.exe')
      )
    ).toBe(true)
    expect(capability.permissions).not.toContain('shell:allow-stdin-write')
  })

  test('redacts bearer-shaped and environment values from visible errors', () => {
    expect(redactCodexText('SILVERPOINT_MCP_AUTH_TOKEN=secret-value')).toBe(
      'SILVERPOINT_MCP_AUTH_TOKEN=[redacted]'
    )
  })
})
