import { describe, expect, test } from 'bun:test'

import { ERROR_CODES, MAX_RESULT_BYTES, classifyError, fail, ok } from '#mcp/result'

describe('MCP result formatting', () => {
  test('returns structured errors for oversized text results', () => {
    const result = ok({ payload: 'x'.repeat(MAX_RESULT_BYTES) }, 'large_tool')

    expect(result.isError).toBe(true)
    expect(result.content[0].type).toBe('text')
    if (result.content[0].type !== 'text') throw new Error('Expected text result')
    const error = JSON.parse(result.content[0].text) as { error: string; code: string }
    expect(error.error).toContain('large_tool')
    expect(error.error).toContain('too large')
    expect(error.code).toBe('result_too_large')
  })

  test('classifyError correctly classifies known failure strings', () => {
    expect(ERROR_CODES).toContain('document_not_found')
    expect(ERROR_CODES).toContain('tool_error')
    expect(classifyError('Document "doc-1" not found')).toBe('document_not_found')
    expect(classifyError('Page "p1" not found in document "doc-1"')).toBe('page_not_found')
    expect(classifyError('No active OpenPencil document open')).toBe('no_active_document')
    expect(classifyError('OpenPencil app is not connected')).toBe('app_not_connected')
    expect(classifyError('RPC timeout (5000ms)')).toBe('rpc_timeout')
    expect(classifyError('Payload is too large (1000KB, limit 900KB). Narrow query.')).toBe(
      'result_too_large'
    )
    expect(classifyError('Path is outside the allowed root: /etc/passwd')).toBe('path_outside_root')
    expect(classifyError('Some random internal error')).toBe('unknown')
  })

  test('fail formats error payload with code', () => {
    const explicit = fail(new Error('custom error'), 'tool_error')
    expect(explicit.isError).toBe(true)
    const parsedExplicit = JSON.parse(explicit.content[0].type === 'text' ? explicit.content[0].text : '{}')
    expect(parsedExplicit.error).toBe('custom error')
    expect(parsedExplicit.code).toBe('tool_error')

    const inferred = fail(new Error('Document "123" not found'))
    const parsedInferred = JSON.parse(inferred.content[0].type === 'text' ? inferred.content[0].text : '{}')
    expect(parsedInferred.error).toBe('Document "123" not found')
    expect(parsedInferred.code).toBe('document_not_found')
  })
})
