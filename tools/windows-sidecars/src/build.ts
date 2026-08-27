import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const target = 'x86_64-pc-windows-msvc'
const root = resolve(import.meta.dir, '..', '..', '..')
const outputDir = join(root, 'desktop', 'binaries')
const mcpOutput = join(outputDir, `silverpoint-mcp-${target}.exe`)
const cssTreeBrowserBundle = join(
  root,
  'node_modules',
  '.bun',
  'css-tree@3.2.1',
  'node_modules',
  'css-tree',
  'dist',
  'csstree.esm.js'
)

function fail(message: string): never {
  throw new Error(`Windows sidecar build failed: ${message}`)
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
}

if (process.platform !== 'win32' || process.arch !== 'x64') fail('requires a Windows x64 host')
if (!existsSync(cssTreeBrowserBundle)) fail('css-tree standalone bundle is unavailable')

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
rmSync(mcpOutput, { force: true })
const build = await Bun.build({
  entrypoints: [join(root, 'packages', 'mcp', 'src', 'index.ts')],
  compile: { target: 'bun-windows-x64', outfile: mcpOutput },
  plugins: [
    {
      name: 'standalone-css-tree',
      setup(builder) {
        builder.onResolve({ filter: /^css-tree$/ }, () => ({ path: cssTreeBrowserBundle }))
      }
    }
  ]
})
if (!build.success || !existsSync(mcpOutput)) {
  for (const log of build.logs) console.error(log)
  fail('MCP standalone compilation did not produce an executable')
}
console.log(`silverpoint-mcp ${sha256(mcpOutput)}`)
