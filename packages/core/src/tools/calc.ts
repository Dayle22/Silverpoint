import ExprEval from 'expr-eval'
import * as v from 'valibot'

import { defineTool } from './schema'

const parser = new ExprEval.Parser()

function evalExpr(
  expr: string
): { expr: string; result: number } | { expr: string; error: string } {
  try {
    const result = parser.evaluate(expr)
    if (!Number.isFinite(result)) {
      return { expr, error: `Produced ${String(result)}` }
    }
    return { expr, result }
  } catch (e) {
    return { expr, error: e instanceof Error ? e.message : String(e) }
  }
}

export const calc = defineTool({
  name: 'calc',
  description:
    'Calculate mathematical expressions. Use this instead of mental math. Returns {expr, result} or {expr, error}. Accepts a single string or JSON array of strings for multiple calculations. Supports standard math operators and functions.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({
    expr: v.pipe(v.string(), v.description('Single expression or JSON array of expressions'))
  }),
  execute: (_figma, { expr }) => {
    let exprs: string[]
    try {
      const parsed = JSON.parse(expr)
      exprs = Array.isArray(parsed) ? parsed : [expr]
    } catch {
      exprs = [expr]
    }

    if (exprs.length === 1) {
      return evalExpr(exprs[0])
    }

    return { results: exprs.map(evalExpr) }
  }
})
