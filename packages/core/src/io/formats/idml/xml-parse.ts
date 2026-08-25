export interface XMLParseNode {
  tag: string
  attrs: Record<string, string>
  children: XMLParseNode[]
  text: string
}

function decodeXmlEntities(str: string): string {
  if (!str.includes('&')) return str
  return str.replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/g, (match) => {
    switch (match) {
      case '&amp;':
        return '&'
      case '&lt;':
        return '<'
      case '&gt;':
        return '>'
      case '&quot;':
        return '"'
      case '&apos;':
        return "'"
      default:
        if (match.startsWith('&#x') || match.startsWith('&#X')) {
          const hex = match.slice(3, -1)
          const code = Number.parseInt(hex, 16)
          return Number.isFinite(code) ? String.fromCodePoint(code) : match
        }
        if (match.startsWith('&#')) {
          const dec = match.slice(2, -1)
          const code = Number.parseInt(dec, 10)
          return Number.isFinite(code) ? String.fromCodePoint(code) : match
        }
        return match
    }
  })
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (!attrString.trim()) return attrs

  const attrRegex = /([a-zA-Z0-9_:\-.]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null = null

  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1]
    const val = match[2] || match[3] || match[4] || ''
    attrs[key] = decodeXmlEntities(val)
  }

  return attrs
}

export function parseTagHeader(headerContent: string): { tagName: string; attrs: Record<string, string> } {
  const firstSpace = headerContent.search(/\s/)
  const tagName = firstSpace === -1 ? headerContent : headerContent.slice(0, firstSpace)
  const attrStr = firstSpace === -1 ? '' : headerContent.slice(firstSpace)
  const attrs = parseAttributes(attrStr)
  return { tagName, attrs }
}

function readCData(xml: string, pos: number, len: number, textParts: string[]): number {
  const cdataEnd = xml.indexOf(']]>', pos + 9)
  if (cdataEnd === -1) {
    textParts.push(xml.slice(pos + 9))
    return len
  }
  textParts.push(xml.slice(pos + 9, cdataEnd))
  return cdataEnd + 3
}

export function parseXML(xml: string): XMLParseNode {
  let pos = 0
  const len = xml.length

  function skipWhitespace() {
    while (pos < len && /\s/.test(xml[pos])) {
      pos++
    }
  }

  function skipCommentOrPI(): boolean {
    if (xml.startsWith('<!--', pos)) {
      const end = xml.indexOf('-->', pos + 4)
      pos = end === -1 ? len : end + 3
      return true
    }
    if (xml.startsWith('<?', pos)) {
      const end = xml.indexOf('?>', pos + 2)
      pos = end === -1 ? len : end + 2
      return true
    }
    if (xml.startsWith('<!DOCTYPE', pos) || xml.startsWith('<!doctype', pos)) {
      const end = xml.indexOf('>', pos + 9)
      pos = end === -1 ? len : end + 1
      return true
    }
    return false
  }

  function parseNode(): XMLParseNode | null {
    while (pos < len) {
      skipWhitespace()
      if (pos >= len) return null

      if (skipCommentOrPI()) {
        continue
      }

      if (xml[pos] !== '<') {
        // Unexpected text outside root or between tags handled in caller
        pos++
        continue
      }

      // Check for closing tag (handled by parent caller)
      if (xml.startsWith('</', pos)) {
        return null
      }

      // Opening tag
      const tagEnd = xml.indexOf('>', pos)
      if (tagEnd === -1) {
        throw new Error(`Malformed XML: unclosed tag at offset ${pos}`)
      }

      const isSelfClosing = xml[tagEnd - 1] === '/'
      const headerContent = isSelfClosing
        ? xml.slice(pos + 1, tagEnd - 1).trim()
        : xml.slice(pos + 1, tagEnd).trim()

      const { tagName, attrs } = parseTagHeader(headerContent)
      pos = tagEnd + 1

      const node: XMLParseNode = {
        tag: tagName,
        attrs,
        children: [],
        text: ''
      }

      if (isSelfClosing) {
        return node
      }

      // Read inner content until closing tag </tagName>
      const textParts: string[] = []

      while (pos < len) {
        if (skipCommentOrPI()) {
          continue
        }

        if (xml.startsWith('<![CDATA[', pos)) {
          pos = readCData(xml, pos, len, textParts)
          continue
        }

        if (xml.startsWith('</', pos)) {
          const closeEnd = xml.indexOf('>', pos)
          if (closeEnd === -1) {
            throw new Error(`Malformed XML: unclosed closing tag at offset ${pos}`)
          }
          pos = closeEnd + 1
          break
        }

        if (xml[pos] === '<') {
          const child = parseNode()
          if (child) {
            node.children.push(child)
          }
          continue
        }

        // Text content
        const nextTag = xml.indexOf('<', pos)
        if (nextTag === -1) {
          textParts.push(decodeXmlEntities(xml.slice(pos)))
          pos = len
        } else {
          textParts.push(decodeXmlEntities(xml.slice(pos, nextTag)))
          pos = nextTag
        }
      }

      node.text = textParts.join('').trim()
      return node
    }

    return null
  }

  const root = parseNode()
  if (!root) {
    throw new Error('Malformed XML: No root element found')
  }

  return root
}

export function findFirstChild(node: XMLParseNode, tag: string): XMLParseNode | undefined {
  return node.children.find((c) => c.tag === tag)
}

export function findAllChildren(node: XMLParseNode, tag: string): XMLParseNode[] {
  return node.children.filter((c) => c.tag === tag)
}

export function findDescendants(node: XMLParseNode, tag: string): XMLParseNode[] {
  const results: XMLParseNode[] = []
  function traverse(n: XMLParseNode) {
    if (n.tag === tag) results.push(n)
    for (const child of n.children) {
      traverse(child)
    }
  }
  for (const child of node.children) {
    traverse(child)
  }
  return results
}
