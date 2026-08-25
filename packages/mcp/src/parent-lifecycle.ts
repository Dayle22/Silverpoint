export interface ParentLivenessMonitorOptions {
  parentPid: number
  intervalMs?: number
  isProcessAlive?: (pid: number) => boolean
  onParentExit: () => void
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Watch the process that directly owns the bundled sidecar.
 *
 * The sidecar only ever stops itself. It does not inspect or terminate the
 * process owning the MCP ports, so an unrelated listener cannot be killed.
 */
export function startParentLivenessMonitor({
  parentPid,
  intervalMs = 1000,
  isProcessAlive: check = isProcessAlive,
  onParentExit
}: ParentLivenessMonitorOptions): () => void {
  let stopped = false
  const timer = setInterval(() => {
    if (stopped || check(parentPid)) return
    stop()
    onParentExit()
  }, intervalMs)

  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
  }
  timer.unref()

  return stop
}
