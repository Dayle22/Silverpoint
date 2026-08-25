import { appLocalDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir } from '@tauri-apps/plugin-fs'

const WORKSPACE_NAME = 'ai-workspace'

export async function getAIWorkspace(): Promise<string> {
  const workspace = await join(await appLocalDataDir(), WORKSPACE_NAME)
  if (!(await exists(workspace))) await mkdir(workspace, { recursive: true })
  return workspace
}
