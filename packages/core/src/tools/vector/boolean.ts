import { defineTool, nodeSummary } from '#core/tools/schema'

export const booleanUnion = defineTool({
  name: 'boolean_union',
  mutates: true,
  description: 'Combine multiple overlapping nodes into a single boolean union node. Returns a summary of the resulting node.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to union', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('UNION', ids)
    return nodeSummary(result)
  }
})

export const booleanSubtract = defineTool({
  name: 'boolean_subtract',
  mutates: true,
  description: 'Subtract the areas of subsequent nodes from the first node. Returns a summary of the resulting boolean subtract node.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs (first minus rest)', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('SUBTRACT', ids)
    return nodeSummary(result)
  }
})

export const booleanIntersect = defineTool({
  name: 'boolean_intersect',
  mutates: true,
  description: 'Create a boolean intersect node from the overlapping areas of multiple nodes. Returns a summary of the resulting node.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to intersect', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('INTERSECT', ids)
    return nodeSummary(result)
  }
})

export const booleanExclude = defineTool({
  name: 'boolean_exclude',
  mutates: true,
  description: 'Create a boolean exclude node that removes the overlapping areas of multiple nodes. Returns a summary of the resulting node.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to exclude', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('EXCLUDE', ids)
    return nodeSummary(result)
  }
})
