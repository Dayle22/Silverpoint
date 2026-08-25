import { describe, expect, test } from 'bun:test'

import { startParentLivenessMonitor } from '#mcp/parent-lifecycle'

describe('bundled MCP parent lifecycle', () => {
  test('stops the sidecar when its owning app process disappears', async () => {
    let ownerAlive = true
    let exited = false

    const stop = startParentLivenessMonitor({
      parentPid: 4242,
      intervalMs: 1,
      isProcessAlive: () => ownerAlive,
      onParentExit: () => {
        exited = true
      }
    })

    ownerAlive = false
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10)
    })
    stop()

    expect(exited).toBe(true)
  })
})
