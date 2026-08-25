import { renderSVGNode, svg, type SVGNode } from '#core/io/formats/svg/node'

export type XMLNode = SVGNode

export const el = svg
export const renderXml = renderSVGNode

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

export function renderDocument(root: XMLNode): string {
  return `${XML_DECLARATION}\n${renderSVGNode(root)}`
}
