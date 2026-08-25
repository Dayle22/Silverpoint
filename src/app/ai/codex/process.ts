import { homeDir } from '@tauri-apps/api/path'

const CODEX_PACKAGE_PATH = [
  'npm',
  'node_modules',
  '@openai',
  'codex',
  'node_modules',
  '@openai',
  'codex-win32-x64',
  'vendor',
  'x86_64-pc-windows-msvc',
  'bin',
  'codex.exe'
]
const runtimeProcess = (globalThis as { process?: { env?: { APPDATA?: string } } }).process
const runtimeAppData = runtimeProcess?.env?.APPDATA
export const CODEX_NATIVE_EXECUTABLE = runtimeAppData
  ? `${runtimeAppData}\\${CODEX_PACKAGE_PATH.join('\\')}`
  : `C:\\Users\\User\\AppData\\Roaming\\${CODEX_PACKAGE_PATH.join('\\')}`
export const CODEX_SHELL_COMMAND = {
  version: 'codex-version',
  loginStatus: 'codex-login-status'
} as const

export function codexExecutableFromHomeDirectory(homeDirectory: string): string {
  return `${homeDirectory.replace(/[\\/]+$/, '')}\\AppData\\Roaming\\${CODEX_PACKAGE_PATH.join('\\')}`
}

export function buildCodexArgs(workspace: string, _prompt?: string): string[] {
  return [
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
    workspace,
    '-c',
    'sandbox_workspace_write.network_access=true',
    '-c',
    'mcp_servers.silverpoint.url="http://127.0.0.1:7600/mcp"',
    '-c',
    'mcp_servers.silverpoint.bearer_token_env_var="SILVERPOINT_MCP_AUTH_TOKEN"'
  ]
}

export function redactCodexText(value: string): string {
  return value
    .replace(/(SILVERPOINT_MCP_AUTH_TOKEN\s*[=:]\s*)[^\s]+/gi, '$1[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .slice(0, 2000)
}

export async function resolveCodexExecutable(): Promise<string> {
  return codexExecutableFromHomeDirectory(await homeDir())
}

export async function probeCodex(args: ['--version'] | ['login', 'status']): Promise<string> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const commandName =
    args[0] === '--version' ? CODEX_SHELL_COMMAND.version : CODEX_SHELL_COMMAND.loginStatus
  const command = Command.create(commandName, args, { encoding: 'utf8' })
  let output = ''
  command.stdout.on('data', (raw: Uint8Array | number[] | string) => {
    output +=
      typeof raw === 'string'
        ? raw
        : new TextDecoder().decode(raw instanceof Uint8Array ? raw : new Uint8Array(raw))
  })
  const child = await command.spawn()
  await new Promise<void>((resolve) => {
    command.on('close', () => {
      resolve()
    })
  })
  await child.kill().catch(() => undefined)
  return redactCodexText(output.trim())
}

export type CodexProcess = { kill: () => Promise<void> }

export async function spawnCodexProcess(options: {
  workspace: string
  prompt: string
  authToken: string
  onData: (chunk: Uint8Array) => void
  onError: (message: string) => void
  onClose: (code: number | null) => void
}): Promise<CodexProcess> {
  const { Channel, invoke } = await import('@tauri-apps/api/core')
  type NativeCodexEvent =
    | { event: 'stdout'; payload: number[] }
    | { event: 'stderr'; payload: string }
    | { event: 'terminated'; payload: { code: number | null } }
  const onEvent = new Channel<NativeCodexEvent>()
  onEvent.onmessage = (event) => {
    if (event.event === 'stdout') options.onData(new Uint8Array(event.payload))
    else if (event.event === 'stderr') options.onError(redactCodexText(event.payload))
    else options.onClose(event.payload.code)
  }
  const jobId = await invoke<number>('spawn_codex_chat', {
    prompt: options.prompt,
    authToken: options.authToken,
    onEvent
  })
  return {
    kill: async () => {
      await invoke('cancel_codex_chat', { jobId })
    }
  }
}
