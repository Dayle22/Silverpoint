import { uniq } from 'es-toolkit/array'
import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

export const getFontStatus = defineTool({
  name: 'get_font_status',
  description:
    'Check if fonts used on the current page are actually available. Returns an object showing requested faces, loaded sources, active substitutions, and affected nodes. Important for debugging text rendering issues.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({}),
  execute: (figma) => figma.getFontStatus()
})

export const listFonts = defineTool({
  name: 'list_fonts',
  description:
    'List the font families currently applied to text nodes on the current page. Returns {count, fonts: [{family, weights: [...]}]}. Optionally filter by family name substring.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({
    family: v.optional(v.pipe(v.string(), v.description('Filter by family name (substring)')))
  }),
  execute: (figma, args) => {
    const fonts = new Map<string, Set<number>>()
    const page = figma.currentPage
    page.findAll((node) => {
      if (node.type === 'TEXT') {
        const raw = figma.graph.getNode(node.id)
        if (raw) {
          const key = raw.fontFamily
          if (!fonts.has(key)) fonts.set(key, new Set())
          fonts.get(key)?.add(raw.fontWeight)
        }
      }
      return false
    })
    let result = [...fonts.entries()].map(([family, weights]) => ({
      family,
      weights: [...weights].sort((a, b) => a - b)
    }))
    if (args.family) {
      const q = args.family.toLowerCase()
      result = result.filter((font) => font.family.toLowerCase().includes(q))
    }
    return { count: result.length, fonts: result }
  }
})

export const listAvailableFonts = defineTool({
  name: 'list_available_fonts',
  description:
    'List all font families the system can render (system fonts + bundled fonts). Returns {count, fonts: ["Arial", ...]}. Use this to discover available fonts to apply, unlike list_fonts which only shows currently used ones.',
  execution: { kind: 'async', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({
    family: v.optional(
      v.pipe(v.string(), v.description('Filter by family name (substring, case-insensitive)'))
    )
  }),
  execute: async (figma, args) => {
    const fonts = await figma.listAvailableFontsAsync()
    let families = uniq(fonts.map((font) => font.fontName.family))
    if (args.family) {
      const q = args.family.toLowerCase()
      families = families.filter((family) => family.toLowerCase().includes(q))
    }
    families.sort((a, b) => a.localeCompare(b))
    return { count: families.length, fonts: families }
  }
})
