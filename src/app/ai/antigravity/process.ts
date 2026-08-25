import { Command } from '@tauri-apps/plugin-shell'
import { mkdir, remove, writeFile } from '@tauri-apps/plugin-fs'

import { decodeTauriStderr } from '@/app/shell/ui'

export const ANTIGRAVITY_EXECUTABLE = 'C:\\Users\\User\\AppData\\Local\\agy\\bin\\agy.exe'
export const ANTIGRAVITY_SHELL_COMMAND = 'antigravity-exec'

type AntigravityStdinWriter = { write: (data: string) => Promise<void> }
export type AntigravityProcess = { kill: () => Promise<void>; cleanup: () => Promise<void> }

function mcpConfigPath(workspace: string): string {
  return `${workspace}\\.agents\\mcp_config.json`
}

export async function prepareAntigravityMcp(workspace: string, authToken: string): Promise<() => Promise<void>> {
  const directory = `${workspace}\\.agents`
  const configPath = mcpConfigPath(workspace)
  await mkdir(directory, { recursive: true })
  await writeFile(configPath, new TextEncoder().encode(JSON.stringify({
    mcpServers: {
      silverpoint: {
        serverUrl: 'http://127.0.0.1:7600/mcp',
        headers: { Authorization: `Bearer ${authToken}` }
      }
    }
  })))
  return async () => { await remove(configPath).catch(() => undefined) }
}

export async function writeAntigravityPrompt(child: AntigravityStdinWriter, prompt: string): Promise<void> {
  await child.write(`${prompt}\n`)
}

export function redactAntigravityText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .slice(0, 4000)
}

export async function spawnAntigravityProcess(options: {
  workspace: string
  prompt: string
  authToken: string
  onData: (chunk: Uint8Array) => void
  onError: (message: string) => void
  onClose: (code: number | null) => void
}): Promise<AntigravityProcess> {
  const cleanupConfig = await prepareAntigravityMcp(options.workspace, options.authToken)
  const command = Command.create(ANTIGRAVITY_SHELL_COMMAND, ['--print', '--dangerously-skip-permissions'], {
    cwd: options.workspace,
    encoding: 'raw'
  })
  command.stdout.on('data', (raw: Uint8Array | number[]) => options.onData(raw instanceof Uint8Array ? raw : new Uint8Array(raw)))
  command.stderr.on('data', (raw: Uint8Array | number[] | string) => options.onError(redactAntigravityText(decodeTauriStderr(raw))))
  command.on('close', (data: { code: number | null }) => options.onClose(data.code))
  try {
    const child = await command.spawn()
    await writeAntigravityPrompt(child, options.prompt)
    return {
      kill: () => child.kill(),
      cleanup: cleanupConfig
    }
  } catch (error) {
    await cleanupConfig()
    throw error
  }
}
