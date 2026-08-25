import { describe, expect, it } from 'bun:test'
import { zipSync } from 'fflate'

import { readIdmlPackage } from '#core/io/formats/idml/import/package'
import { readIdmlSummary } from '#core/io/formats/idml/import/summary'
import {
  IDML_MAX_FILE_SIZE_BYTES,
  IDML_MAX_PAGE_COUNT,
  type IdmlImportDiagnostic
} from '#core/io/formats/idml/import/types'
import { writeIdmlPackage } from '#core/io/formats/idml/package'
import {
  findAllChildren,
  findDescendants,
  findFirstChild,
  parseTagHeader,
  parseXML
} from '#core/io/formats/idml/xml-parse'

describe('IDML XML Pull-Parser — Unit Tests', () => {
  it('parses basic XML document with declaration, attributes and text', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document name="Test Doc" version="1.0">
  <Title>Hello World</Title>
</Document>`

    const root = parseXML(xml)
    expect(root.tag).toBe('Document')
    expect(root.attrs['name']).toBe('Test Doc')
    expect(root.attrs['version']).toBe('1.0')
    expect(root.children).toHaveLength(1)

    const title = root.children[0]
    expect(title.tag).toBe('Title')
    expect(title.text).toBe('Hello World')
  })

  it('handles self-closing elements and mixed quotes in attributes', () => {
    const xml = `<root>
  <Item id="1" active='true' empty="" unquoted=flag />
  <Item id="2" type="secondary"/>
</root>`

    const root = parseXML(xml)
    expect(root.children).toHaveLength(2)
    expect(root.children[0].tag).toBe('Item')
    expect(root.children[0].attrs['id']).toBe('1')
    expect(root.children[0].attrs['active']).toBe('true')
    expect(root.children[0].attrs['empty']).toBe('')
    expect(root.children[0].attrs['unquoted']).toBe('flag')
    expect(root.children[1].attrs['id']).toBe('2')
    expect(root.children[1].attrs['type']).toBe('secondary')
  })

  it('parses tag headers correctly with parseTagHeader', () => {
    const header1 = 'Rectangle Self="u123" ItemTransform="1 0 0 1 0 0"'
    const res1 = parseTagHeader(header1)
    expect(res1.tagName).toBe('Rectangle')
    expect(res1.attrs['Self']).toBe('u123')
    expect(res1.attrs['ItemTransform']).toBe('1 0 0 1 0 0')

    const header2 = 'Page'
    const res2 = parseTagHeader(header2)
    expect(res2.tagName).toBe('Page')
    expect(Object.keys(res2.attrs)).toHaveLength(0)
  })

  it('decodes standard XML entities and numeric character references', () => {
    const xml = `<Text text="A &amp; B &lt; C &gt; &quot;D&quot; &apos;E&apos; &#65; &#x42;">
  &amp; &lt; &gt; &quot; &apos; &#x20AC; &#8364;
</Text>`

    const root = parseXML(xml)
    expect(root.attrs['text']).toBe('A & B < C > "D" \'E\' A B')
    expect(root.text).toBe('& < > " \' € €')
  })

  it('preserves CDATA sections without escaping', () => {
    const xml = `<Image>
  <Contents><![CDATA[iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==]]></Contents>
</Image>`

    const root = parseXML(xml)
    const contents = findFirstChild(root, 'Contents')
    expect(contents).toBeDefined()
    expect(contents?.text).toBe(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    )
  })

  it('handles unclosed CDATA gracefully', () => {
    const xml = `<Image><Contents><![CDATA[unclosed cdata payload</Contents></Image>`
    const root = parseXML(xml)
    const contents = findFirstChild(root, 'Contents')
    expect(contents?.text).toBe('unclosed cdata payload</Contents></Image>')
  })

  it('ignores comments, processing instructions and doctypes', () => {
    const xml = `<?xml version="1.0" standalone="yes"?>
<!DOCTYPE Document SYSTEM "idml.dtd">
<!-- Leading document comment -->
<Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" Self="s1">
  <!-- Inside comment -->
  <?custom-pi data="ignored"?>
  <Rectangle Self="r1" GeometricBounds="0 0 100 100" />
</Spread>`

    const root = parseXML(xml)
    expect(root.tag).toBe('Spread')
    expect(root.attrs['xmlns:idPkg']).toBe(
      'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging'
    )
    expect(root.attrs['Self']).toBe('s1')
    expect(root.children).toHaveLength(1)
    expect(root.children[0].tag).toBe('Rectangle')
    expect(root.children[0].attrs['Self']).toBe('r1')
  })

  it('finds children and descendants with helper functions', () => {
    const xml = `<Document>
  <idPkg:Spread src="Spreads/Spread_s1.xml"/>
  <idPkg:Spread src="Spreads/Spread_s2.xml"/>
  <Group>
    <Rectangle Self="r1"/>
    <Group>
      <Rectangle Self="r2"/>
    </Group>
  </Group>
</Document>`

    const root = parseXML(xml)
    const spreads = findAllChildren(root, 'idPkg:Spread')
    expect(spreads).toHaveLength(2)
    expect(spreads[0].attrs['src']).toBe('Spreads/Spread_s1.xml')

    const allRects = findDescendants(root, 'Rectangle')
    expect(allRects).toHaveLength(2)
    expect(allRects.map((r) => r.attrs['Self'])).toEqual(['r1', 'r2'])
  })

  it('fails cleanly on empty or malformed XML without infinite loops', () => {
    expect(() => parseXML('')).toThrow('Malformed XML')
    expect(() => parseXML('   ')).toThrow('Malformed XML')
    expect(() => parseXML('<!-- only a comment -->')).toThrow('Malformed XML')
    expect(() => parseXML('<unclosed-tag')).toThrow('Malformed XML')
  })
})

describe('IDML Package Reader & Limits — Unit Tests', () => {
  it('rejects empty input data with IDML_EMPTY_FILE', () => {
    const diagnostics: IdmlImportDiagnostic[] = []
    const pkg = readIdmlPackage(new Uint8Array(0), diagnostics)
    expect(pkg).toBeNull()
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].code).toBe('IDML_EMPTY_FILE')
    expect(diagnostics[0].severity).toBe('error')
  })

  it('rejects oversized input data exceeding 100MB limit with IDML_FILE_TOO_LARGE', () => {
    const diagnostics: IdmlImportDiagnostic[] = []
    const oversizedData = new Uint8Array(10)
    Object.defineProperty(oversizedData, 'byteLength', {
      value: IDML_MAX_FILE_SIZE_BYTES + 1
    })

    const pkg = readIdmlPackage(oversizedData, diagnostics)
    expect(pkg).toBeNull()
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].code).toBe('IDML_FILE_TOO_LARGE')
    expect(diagnostics[0].severity).toBe('error')
  })

  it('rejects corrupted zip archive with IDML_INVALID_ZIP', () => {
    const diagnostics: IdmlImportDiagnostic[] = []
    const corruptData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const pkg = readIdmlPackage(corruptData, diagnostics)
    expect(pkg).toBeNull()
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].code).toBe('IDML_INVALID_ZIP')
    expect(diagnostics[0].severity).toBe('error')
  })

  it('rejects zip archive missing designmap.xml with IDML_MISSING_DESIGNMAP', () => {
    const diagnostics: IdmlImportDiagnostic[] = []
    const zipData = zipSync({
      'some-other-file.xml': new TextEncoder().encode('<xml/>')
    })

    const pkg = readIdmlPackage(zipData, diagnostics)
    expect(pkg).toBeNull()
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].code).toBe('IDML_MISSING_DESIGNMAP')
    expect(diagnostics[0].severity).toBe('error')
  })

  it('rejects zip archive with corrupt designmap.xml with IDML_CORRUPT_DESIGNMAP', () => {
    const diagnostics: IdmlImportDiagnostic[] = []
    const zipData = zipSync({
      'designmap.xml': new TextEncoder().encode('<unclosed-tag')
    })

    const pkg = readIdmlPackage(zipData, diagnostics)
    expect(pkg).toBeNull()
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].code).toBe('IDML_CORRUPT_DESIGNMAP')
    expect(diagnostics[0].severity).toBe('error')
  })

  it('resolves custom rootfile path from META-INF/container.xml', () => {
    const diagnostics: IdmlImportDiagnostic[] = []
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="custom/path/designmap.xml" media-type="application/vnd.adobe.indesign-idml-package"/>
  </rootfiles>
</container>`

    const designMapXml = `<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">
  <idPkg:Spread src="Spreads/Spread_1.xml"/>
</Document>`

    const zipData = writeIdmlPackage({
      'META-INF/container.xml': containerXml,
      'custom/path/designmap.xml': designMapXml
    })

    const pkg = readIdmlPackage(zipData, diagnostics)
    expect(pkg).toBeDefined()
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(pkg?.spreadPaths).toEqual(['Spreads/Spread_1.xml'])
  })

  it('falls back to Spreads/ and Stories/ entries when designmap has no explicit idPkg references', () => {
    const diagnostics: IdmlImportDiagnostic[] = []
    const designMapXml = `<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">
</Document>`

    const zipData = writeIdmlPackage({
      'designmap.xml': designMapXml,
      'Spreads/Spread_a.xml': '<Spread/>',
      'Spreads/Spread_b.xml': '<Spread/>',
      'Stories/Story_1.xml': '<Story/>'
    })

    const pkg = readIdmlPackage(zipData, diagnostics)
    expect(pkg).toBeDefined()
    expect(pkg?.spreadPaths).toContain('Spreads/Spread_a.xml')
    expect(pkg?.spreadPaths).toContain('Spreads/Spread_b.xml')
    expect(pkg?.storyPaths).toEqual(['Stories/Story_1.xml'])
  })
})

describe('readIdmlSummary — Page Bounds & Limits Foundation', () => {
  it('extracts stable page summary without creating scene nodes', async () => {
    const designMapXml = `<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">
  <idPkg:Spread src="Spreads/Spread_1.xml"/>
  <idPkg:Spread src="Spreads/Spread_2.xml"/>
</Document>`

    const spread1Xml = `<Spread Self="s1">
  <Page Self="p1" GeometricBounds="0 0 600 400" />
</Spread>`

    const spread2Xml = `<Spread Self="s2">
  <Page Self="p2" GeometricBounds="0 0 800 500" />
</Spread>`

    const zipData = writeIdmlPackage({
      'designmap.xml': designMapXml,
      'Spreads/Spread_1.xml': spread1Xml,
      'Spreads/Spread_2.xml': spread2Xml
    })

    const summary = await readIdmlSummary(zipData)
    expect(summary.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(summary.pages).toHaveLength(2)

    expect(summary.pages[0]).toEqual({
      pageNumber: 1,
      widthPt: 400,
      heightPt: 600
    })

    expect(summary.pages[1]).toEqual({
      pageNumber: 2,
      widthPt: 500,
      heightPt: 800
    })
  })

  it('rejects packages exceeding IDML_MAX_PAGE_COUNT limit (200 pages)', async () => {
    const entries: Record<string, string> = {
      'designmap.xml': `<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"><idPkg:Spread src="Spreads/Spread_1.xml"/></Document>`
    }

    const pagesXml = Array.from(
      { length: IDML_MAX_PAGE_COUNT + 1 },
      (_, i) => `<Page Self="p_${i}" GeometricBounds="0 0 500 400"/>`
    ).join('\n')

    entries['Spreads/Spread_1.xml'] = `<Spread Self="s1">${pagesXml}</Spread>`

    const zipData = writeIdmlPackage(entries)
    const summary = await readIdmlSummary(zipData)

    expect(summary.pages).toHaveLength(0)
    const countDiag = summary.diagnostics.find((d) => d.code === 'IDML_PAGE_COUNT_EXCEEDED')
    expect(countDiag).toBeDefined()
    expect(countDiag?.severity).toBe('error')
  })
})
