import { spawn } from 'node:child_process'

import type { Plugin } from 'vite'

// TODO: production — bundle MCP server as Tauri sidecar or spawn via shell plugin
export function automationPlugin(authToken: string | null, corsOrigin: string): Plugin {
  let child: ReturnType<typeof spawn> | null = null

  // Overridable so a second dev server or a test run can take its own ports
  // instead of colliding on 7600/7601.
  const httpPort = process.env.OPENPENCIL_MCP_PORT ?? '7600'
  const wsPort = process.env.OPENPENCIL_MCP_WS_PORT ?? '7601'

  return {
    name: 'open-pencil-automation',
    configureServer() {
      if (child) return

      child = spawn('bun', ['run', 'packages/mcp/src/index.ts'], {
        stdio: ['ignore', 'inherit', 'pipe'],
        env: {
          ...process.env,
          PORT: httpPort,
          WS_PORT: wsPort,
          ...(authToken ? { OPENPENCIL_MCP_AUTH_TOKEN: authToken } : {}),
          OPENPENCIL_MCP_CORS_ORIGIN: corsOrigin
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (text.includes('EADDRINUSE')) {
          console.error(
            `\x1b[33m[MCP] Port ${httpPort} already in use — the automation bridge is disabled for this session. Set OPENPENCIL_MCP_PORT to use a different port.\x1b[0m`
          )
          child?.kill()
          child = null
          return
        }
        process.stderr.write(data)
      })

      child.on('exit', (code) => {
        if (code && code !== 0 && child) {
          console.error(`[MCP] Server exited with code ${code}`)
        }
        child = null
      })
    },
    buildEnd() {
      child?.kill()
      child = null
    }
  }
}
