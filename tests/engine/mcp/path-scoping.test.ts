import { describe, test, expect } from 'bun:test'
import { resolve } from 'node:path'

import { resolveSafePath } from '#mcp/tool/output'

describe('MCP path scoping', () => {
  const root = resolve('/tmp/mcp-test-root')

  test('allows path inside root', () => {
    expect(resolveSafePath(`${root}/design.fig`, root)).toBe(resolve(root, 'design.fig'))
  })

  test('allows nested path inside root', () => {
    expect(resolveSafePath(`${root}/sub/dir/file.fig`, root)).toBe(resolve(root, 'sub', 'dir', 'file.fig'))
  })

  test('allows root itself', () => {
    expect(resolveSafePath(root, root)).toBe(root)
  })

  test('rejects path outside root', () => {
    expect(() => resolveSafePath('/etc/passwd', root)).toThrow('outside the allowed root')
  })

  test('rejects path traversal', () => {
    expect(() => resolveSafePath(`${root}/../../../etc/passwd`, root)).toThrow(
      'outside the allowed root'
    )
  })

  test('rejects sibling directory', () => {
    expect(() => resolveSafePath(`${root}/../other-root/file.fig`, root)).toThrow(
      'outside the allowed root'
    )
  })

  test('rejects root prefix trick (root-evil)', () => {
    expect(() => resolveSafePath(`${root}-evil/file.fig`, root)).toThrow('outside the allowed root')
  })
})
