import { zipSync, type Zippable } from 'fflate'

export const IDML_MIME_TYPE = 'application/vnd.adobe.indesign-idml-package'

export function writeIdmlPackage(entries: Record<string, Uint8Array | string>): Uint8Array {
  const encoder = new TextEncoder()
  const zipEntries: Zippable = {
    mimetype: [encoder.encode(IDML_MIME_TYPE), { level: 0 }]
  }

  for (const [name, content] of Object.entries(entries)) {
    if (name === 'mimetype') continue
    const data = typeof content === 'string' ? encoder.encode(content) : content
    zipEntries[name] = data
  }

  return zipSync(zipEntries)
}
