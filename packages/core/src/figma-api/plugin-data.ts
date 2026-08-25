import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export const OPEN_PENCIL_PLUGIN_DATA_NAMESPACE = 'open-pencil'

type PluginDataEntry = SceneNode['pluginData'][number]

export function isOpenPencilPluginData(entry: PluginDataEntry): boolean {
  return entry.pluginId === OPEN_PENCIL_PLUGIN_DATA_NAMESPACE
}

function encodedSharedKey(entry: PluginDataEntry, namespace: string): string | null {
  const prefix = `${namespace}/`
  if (entry.pluginId !== namespace || !entry.key.startsWith(prefix)) return null
  return entry.key.slice(prefix.length)
}

function isEncodedSharedPluginData(entry: PluginDataEntry): boolean {
  return encodedSharedKey(entry, entry.pluginId) !== null
}

function matchesSharedPluginData(entry: PluginDataEntry, namespace: string, key: string): boolean {
  const encodedKey = encodedSharedKey(entry, namespace)
  if (encodedKey !== null) return encodedKey === key
  if (isOpenPencilPluginData(entry)) return false
  return entry.pluginId === namespace && entry.key === key
}

function sharedPluginDataKey(entry: PluginDataEntry, namespace: string): string | null {
  const encodedKey = encodedSharedKey(entry, namespace)
  if (encodedKey !== null) return encodedKey
  if (isOpenPencilPluginData(entry)) return null
  return entry.pluginId === namespace ? entry.key : null
}

export function getPluginData(node: SceneNode, key: string): string {
  const entries = Array.isArray(node.pluginData) ? node.pluginData : []
  return (
    entries.find((entry) => isOpenPencilPluginData(entry) && entry.key === key)?.value ?? ''
  )
}

export function setPluginData(
  graph: SceneGraph,
  node: SceneNode,
  key: string,
  value: string
): void {
  const entries = Array.isArray(node.pluginData) ? node.pluginData : []
  const pluginData = entries.filter(
    (entry) => !(isOpenPencilPluginData(entry) && entry.key === key)
  )
  if (value !== '') {
    pluginData.push({ pluginId: OPEN_PENCIL_PLUGIN_DATA_NAMESPACE, key, value })
  }
  graph.updateNode(node.id, { pluginData })
}

export function getPluginDataKeys(node: SceneNode): string[] {
  const entries = Array.isArray(node.pluginData) ? node.pluginData : []
  return entries
    .filter((entry) => isOpenPencilPluginData(entry) && !isEncodedSharedPluginData(entry))
    .map((entry) => entry.key)
}

export function getSharedPluginData(node: SceneNode, namespace: string, key: string): string {
  const entries = Array.isArray(node.pluginData) ? node.pluginData : []
  return (
    entries.find((entry) => matchesSharedPluginData(entry, namespace, key))?.value ?? ''
  )
}

export function setSharedPluginData(
  graph: SceneGraph,
  node: SceneNode,
  namespace: string,
  key: string,
  value: string
): void {
  const entries = Array.isArray(node.pluginData) ? node.pluginData : []
  const pluginData = entries.filter(
    (entry) => !matchesSharedPluginData(entry, namespace, key)
  )
  if (value !== '') {
    pluginData.push({ pluginId: namespace, key: `${namespace}/${key}`, value })
  }
  graph.updateNode(node.id, { pluginData })
}

export function getSharedPluginDataKeys(node: SceneNode, namespace: string): string[] {
  const entries = Array.isArray(node.pluginData) ? node.pluginData : []
  return entries.flatMap((entry) => {
    const key = sharedPluginDataKey(entry, namespace)
    return key === null ? [] : [key]
  })
}
