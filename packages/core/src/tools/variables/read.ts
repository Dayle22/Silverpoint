import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

export const listVariables = defineTool({
  name: 'list_variables',
  description:
    'List all design variables in the document, optionally filtered by type. Returns {count, variables: [{id, name, type, ...}]}.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    type: v.optional(
      v.pipe(
        v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
        v.description('Filter by variable type')
      )
    )
  }),
  execute: (figma, args) => {
    const variables = figma.getLocalVariables(args.type)
    return { count: variables.length, variables }
  }
})

export const getVariable = defineTool({
  name: 'get_variable',
  description:
    'Retrieve full details of a specific design variable by its ID. Returns the complete variable object.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    id: v.pipe(v.string(), v.description('Variable ID'))
  }),
  execute: (figma, { id }) => {
    const variable = figma.getVariableById(id)
    if (!variable) return { error: `Variable "${id}" not found` }
    return variable
  }
})

export const findVariables = defineTool({
  name: 'find_variables',
  description:
    'Search for variables by a case-insensitive name substring and optional type. Returns {count, variables: [{id, name, type, ...}]}.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    query: v.pipe(v.string(), v.description('Name substring (case-insensitive)')),
    type: v.optional(
      v.pipe(v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']), v.description('Filter by type'))
    )
  }),
  execute: (figma, args) => {
    let variables = figma.getLocalVariables(args.type)
    variables = variables.filter((variable) =>
      variable.name.toLowerCase().includes(args.query.toLowerCase())
    )
    return { count: variables.length, variables }
  }
})
