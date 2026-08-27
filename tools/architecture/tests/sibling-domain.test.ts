import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const temporaryDirectories: string[] = []
const repositoryRoot = resolve(import.meta.dir, '../../..')
const oxlint = join(repositoryRoot, 'node_modules/.bin/oxlint')
const plugin = join(repositoryRoot, 'lint/plugin.js')

function lint(
  targetRelativePath: string,
  files: Record<string, string>,
  directories: string[] = []
): ReturnType<typeof Bun.spawnSync> {
  const directory = mkdtempSync(join(tmpdir(), 'open-pencil-sibling-lint-'))
  temporaryDirectories.push(directory)
  const config = join(directory, 'oxlint.json')
  writeFileSync(
    config,
    JSON.stringify({
      jsPlugins: [plugin],
      rules: { 'open-pencil/no-sibling-domain-prefixed-files': 'error' }
    })
  )
  for (const dir of directories) {
    mkdirSync(join(directory, dir), { recursive: true })
  }
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(directory, relPath)
    writeFileSync(fullPath, content)
  }
  const targetFile = join(directory, targetRelativePath)
  return Bun.spawnSync([oxlint, '--config', config, targetFile], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('no-sibling-domain-prefixed-files rule', () => {
  test('rejects files repeating an existing sibling domain directory name', () => {
    const result = lint(
      'src/components/selection-container.ts',
      {
        'src/components/selection/container.ts': 'export const a = 1\n',
        'src/components/selection-container.ts': 'export const b = 2\n'
      },
      ['src/components/selection']
    )
    expect(result.exitCode).toBe(1)
    expect(result.stdout.toString()).toContain('no-sibling-domain-prefixed-files')
  })

  test('allows files when candidate prefix is an empty directory', () => {
    const result = lint(
      'src/theme/app-select.ts',
      {
        'src/theme/app-select.ts': 'export const c = 3\n'
      },
      ['src/theme/app']
    )
    expect(result.exitCode).toBe(0)
  })

  test('allows files when candidate is only a sibling file, not a directory', () => {
    const result = lint(
      'src/theme/app-select.ts',
      {
        'src/theme/select.ts': 'export const select = 1\n',
        'src/theme/app-select.ts': 'export const appSelect = 2\n'
      },
      ['src/theme']
    )
    expect(result.exitCode).toBe(0)
  })
})