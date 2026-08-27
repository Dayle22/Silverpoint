class FakeStyle {
  props: Record<string, string>

  constructor(props: Record<string, string> = {}) {
    this.props = { ...props }
  }

  getPropertyValue(name: string): string {
    return this.props[name] ?? ''
  }

  setProperty(name: string, val: string): void {
    this.props[name] = String(val)
  }
}

export class FakeElement {
  nodeType = 1
  nodeName: string
  tagName: string
  localName: string
  attrs: Record<string, string>
  childNodes: FakeElement[] = []
  children: FakeElement[] = []
  style: FakeStyle
  ownerDocument: FakeDocument | null = null
  parentElement: FakeElement | null = null
  parentNode: FakeElement | null = null
  namespaceURI = 'http://www.w3.org/2000/svg'

  constructor(tag: string, attrs: Record<string, string> = {}) {
    this.nodeName = tag.toUpperCase()
    this.tagName = tag.toUpperCase()
    this.localName = tag.toLowerCase()
    this.attrs = { ...attrs }
    this.style = new FakeStyle()

    if (attrs.style) {
      const parts = attrs.style.split(';')
      for (const p of parts) {
        const [k, v] = p.split(':')
        if (k && v) this.style.setProperty(k.trim(), v.trim())
      }
    }
  }

  get id(): string {
    return this.attrs.id ?? ''
  }

  set id(val: string) {
    this.attrs.id = val
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null
  }

  hasAttribute(name: string): boolean {
    return name in this.attrs
  }

  setAttribute(name: string, val: unknown): void {
    this.attrs[name] = String(val)
  }

  removeAttribute(name: string): void {
    Reflect.deleteProperty(this.attrs, name)
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this
    child.parentNode = this
    this.childNodes.push(child)
    if (child.nodeType === 1) this.children.push(child)
    return child
  }

  removeChild(child: FakeElement): FakeElement {
    this.childNodes = this.childNodes.filter((c) => c !== child)
    this.children = this.children.filter((c) => c !== child)
    return child
  }

  querySelector(sel: string): FakeElement | null {
    if (sel.startsWith('#')) {
      const id = sel.slice(1)
      const search = (el: FakeElement): FakeElement | null => {
        if (el.getAttribute('id') === id) return el
        for (const child of el.children) {
          const found = search(child)
          if (found) return found
        }
        return null
      }
      return search(this)
    }
    return null
  }

  querySelectorAll(_sel: string): FakeElement[] {
    return []
  }

  getElementsByTagName(tag: string): FakeElement[] {
    const res: FakeElement[] = []
    for (const c of this.childNodes) {
      if (c.tagName && c.tagName.toLowerCase() === tag.toLowerCase()) res.push(c)
      if (c.getElementsByTagName) res.push(...c.getElementsByTagName(tag))
    }
    return res
  }

  cloneNode(deep?: boolean): FakeElement {
    const clone = new FakeElement(this.tagName, this.attrs)
    if (deep) {
      for (const c of this.childNodes) {
        if (c.cloneNode) clone.appendChild(c.cloneNode(true))
      }
    }
    return clone
  }
}

export class FakeDocument {
  documentElement: FakeElement | null = null
  nodeType = 9
  implementation = {
    createHTMLDocument: () => ({
      body: new FakeElement('body'),
      createElement: (tag: string) => new FakeElement(tag)
    })
  }
  styleSheets: unknown[] = []

  createElement(tag: string): FakeElement {
    const el = new FakeElement(tag)
    el.ownerDocument = this
    return el
  }

  createElementNS(_ns: string, tag: string): FakeElement {
    const el = new FakeElement(tag)
    el.ownerDocument = this
    return el
  }

  querySelector(sel: string): FakeElement | null {
    if (!this.documentElement) return null
    return this.documentElement.querySelector(sel)
  }

  querySelectorAll(_sel: string): FakeElement[] {
    return []
  }

  getElementById(id: string): FakeElement | null {
    if (!this.documentElement) return null
    const search = (el: FakeElement): FakeElement | null => {
      if (el.getAttribute('id') === id) return el
      for (const child of el.children) {
        const found = search(child)
        if (found) return found
      }
      return null
    }
    return search(this.documentElement)
  }

  getElementsByTagName(_tag: string): FakeElement[] {
    return []
  }
}

export function parseSVGToFakeDOM(xml: string): FakeDocument {
  const doc = new FakeDocument()
  const tagRegex = /<([a-zA-Z0-9:-]+)([^>]*)>|<\/([a-zA-Z0-9:-]+)>/g
  const attrRegex = /([a-zA-Z0-9:-]+)=["']([^"']*)["']/g

  let root: FakeElement | null = null
  const stack: FakeElement[] = []
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(xml)) !== null) {
    const [, openTag, attrStr, closeTag] = match
    if (openTag) {
      const attrs: Record<string, string> = {}
      let aMatch: RegExpExecArray | null
      const attrString = attrStr ?? ''
      while ((aMatch = attrRegex.exec(attrString)) !== null) {
        attrs[aMatch[1]] = aMatch[2]
      }
      const trimmed = attrString.trim()
      const isSelfClosing =
        trimmed.endsWith('/') ||
        ['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'path', 'image'].includes(
          openTag.toLowerCase()
        )
      const el = new FakeElement(openTag, attrs)
      el.ownerDocument = doc

      if (!root) {
        root = el
        doc.documentElement = el
      }

      const parent = stack[stack.length - 1]
      if (parent) {
        parent.appendChild(el)
      }

      if (!isSelfClosing && !trimmed.endsWith('/')) {
        stack.push(el)
      }
    } else if (closeTag) {
      if (
        stack.length > 0 &&
        stack[stack.length - 1].tagName.toLowerCase() === closeTag.toLowerCase()
      ) {
        stack.pop()
      }
    }
  }
  return doc
}

type MutableGlobal = typeof globalThis & {
  document?: unknown
  window?: unknown
  DOMParser?: unknown
}

export function setupFakeDomEnvironment() {
  const g = globalThis as MutableGlobal
  if (g.document === undefined) {
    g.document = new FakeDocument()
  }
  if (g.window === undefined) {
    g.window = globalThis
  }
  const win = g.window as { getComputedStyle?: (el: FakeElement) => FakeStyle }
  if (win.getComputedStyle === undefined) {
    win.getComputedStyle = (el: FakeElement) => el?.style || new FakeStyle()
  }
  if (g.DOMParser === undefined) {
    g.DOMParser = class DOMParser {
      parseFromString(xml: string, _mime: string) {
        const doc = parseSVGToFakeDOM(xml)
        g.document = doc
        return doc
      }
    }
  }
}
