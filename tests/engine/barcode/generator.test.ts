import { describe, expect, test } from 'bun:test'
import {
  checkFiniteDimensions,
  checkGuardBarIntegrity,
  checkModuleGridConsistency,
  checkQuietZoneClear,
  createEditor,
  createVectorNetworkBuilder,
  exportFigFile,
  generateEAN13Plan,
  generateQRCodePlan,
  getBarcodeMetadata,
  hasBarcodeConflict,
  initCodec,
  parseFigFile,
  SceneGraph,
  validateVectorNetwork,
  type QRCodeOptions
} from '@open-pencil/core'
import { getPluginData } from '#core/figma-api/plugin-data'
import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { vectorChild } from '#tests/helpers/barcode'

describe('QR Code Generation', () => {
  test('generates valid QR plan with 4-module quiet zone and integer dimensions', () => {
    const options: QRCodeOptions = {
      type: 'QR_CODE',
      payload: 'https://silverpoint.org',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    }

    const plan = generateQRCodePlan(options)
    expect(plan.type).toBe('QR_CODE')
    expect(plan.metadata.payload).toBe('https://silverpoint.org')
    expect(plan.metadata.options.ecc).toBe('M')
    expect(plan.info?.version).toBeDefined()
    expect(plan.info?.version).toBeGreaterThanOrEqual(1)

    // Check dimensions: (matrixSize + 8) * moduleSize
    // Version 2 is 25x25, quiet zone is 4 on all sides -> total 33x33 -> 33 * 4 = 132
    expect(plan.width % 4).toBe(0)
    expect(plan.height).toBe(plan.width)

    // Check children
    expect(plan.children).toHaveLength(2)
    const [bg, modules] = plan.children
    expect(bg.role).toBe('background')
    expect(modules.role).toBe('modules')

    // Validate vector networks
    if (bg.role === 'background') {
      expect(validateVectorNetwork(bg.vectorNetwork)).toEqual([])
      expect(bg.vectorNetwork.regions.length).toBeGreaterThan(0)
    }
    if (modules.role === 'modules') {
      expect(validateVectorNetwork(modules.vectorNetwork)).toEqual([])
      expect(modules.vectorNetwork.regions.length).toBe(plan.info?.moduleCount)
    }

    expect(plan.scanCheck.status).toBe('PASS')
  })

  test('preserves ECC level and rejects empty or over-capacity payload', () => {
    const eccLevels: Array<'L' | 'M' | 'Q' | 'H'> = ['L', 'M', 'Q', 'H']
    for (const ecc of eccLevels) {
      const plan = generateQRCodePlan({
        type: 'QR_CODE',
        payload: 'test ecc',
        ecc,
        moduleSize: 3,
        style: 'square',
        darkColor: { r: 0, g: 0, b: 0, a: 1 },
        lightColor: { r: 1, g: 1, b: 1, a: 1 }
      })
      expect(plan.metadata.options.ecc).toBe(ecc)
    }

    expect(() =>
      generateQRCodePlan({
        type: 'QR_CODE',
        payload: '',
        ecc: 'M',
        moduleSize: 4,
        style: 'square',
        darkColor: { r: 0, g: 0, b: 0, a: 1 },
        lightColor: { r: 1, g: 1, b: 1, a: 1 }
      })
    ).toThrow()

    // Version 40 with ECC H caps out around 1273 bytes; this payload exceeds
    // the capacity of every ECC level, so it must be a genuine rejection.
    const overCapacityPayload = 'A'.repeat(5000)
    expect(() =>
      generateQRCodePlan({
        type: 'QR_CODE',
        payload: overCapacityPayload,
        ecc: 'M',
        moduleSize: 4,
        style: 'square',
        darkColor: { r: 0, g: 0, b: 0, a: 1 },
        lightColor: { r: 1, g: 1, b: 1, a: 1 }
      })
    ).toThrow()
  })

  test('styles (square, rounded, dots) produce distinct vector networks with square finder patterns', () => {
    const base: QRCodeOptions = {
      type: 'QR_CODE',
      payload: 'Silverpoint Styles',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    }

    const planSquare = generateQRCodePlan({ ...base, style: 'square' })
    const planRounded = generateQRCodePlan({ ...base, style: 'rounded' })
    const planDots = generateQRCodePlan({ ...base, style: 'dots' })

    const vnSquare = vectorChild(planSquare, 'modules').vectorNetwork
    const vnRounded = vectorChild(planRounded, 'modules').vectorNetwork
    const vnDots = vectorChild(planDots, 'modules').vectorNetwork

    expect(validateVectorNetwork(vnSquare)).toEqual([])
    expect(validateVectorNetwork(vnRounded)).toEqual([])
    expect(validateVectorNetwork(vnDots)).toEqual([])

    // Verify they are different (square has straight segments, rounded and dots have curves with tangents)
    expect(vnSquare.vertices.length).not.toBe(vnRounded.vertices.length)
    expect(vnSquare.segments.some((s) => s.tangentStart.x !== 0 || s.tangentStart.y !== 0)).toBe(false)
    expect(vnRounded.segments.some((s) => s.tangentStart.x !== 0 || s.tangentStart.y !== 0)).toBe(true)
    expect(vnDots.segments.some((s) => s.tangentStart.x !== 0 || s.tangentStart.y !== 0)).toBe(true)
  })

  test('scan check detects low contrast and inverted luminance', () => {
    const lowContrastPlan = generateQRCodePlan({
      type: 'QR_CODE',
      payload: 'https://silverpoint.org',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      lightColor: { r: 0.55, g: 0.55, b: 0.55, a: 1 }
    })
    expect(lowContrastPlan.scanCheck.status).toBe('WARN')
    expect(lowContrastPlan.scanCheck.warnings.length).toBeGreaterThan(0)

    const invertedPlan = generateQRCodePlan({
      type: 'QR_CODE',
      payload: 'https://silverpoint.org',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 1, g: 1, b: 1, a: 1 },
      lightColor: { r: 0, g: 0, b: 0, a: 1 }
    })
    expect(invertedPlan.scanCheck.status).toBe('WARN')
  })

  test('reports the real measured contrast ratio, not a placeholder', () => {
    const blackOnWhite = generateQRCodePlan({
      type: 'QR_CODE',
      payload: 'https://silverpoint.org',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })
    // Black on white is the maximum possible contrast ratio: 21:1
    expect(blackOnWhite.scanCheck.contrastRatio).toBeCloseTo(21, 0)
    expect(blackOnWhite.scanCheck.contrastRatio).not.toBe(0)

    const midGrayPair = generateQRCodePlan({
      type: 'QR_CODE',
      payload: 'https://silverpoint.org',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      lightColor: { r: 0.55, g: 0.55, b: 0.55, a: 1 }
    })
    // Different color pairs must produce different measured ratios
    expect(midGrayPair.scanCheck.contrastRatio).not.toBe(blackOnWhite.scanCheck.contrastRatio)
    expect(midGrayPair.scanCheck.contrastRatio).toBeGreaterThan(1)
    expect(midGrayPair.scanCheck.contrastRatio).toBeLessThan(3)
  })

  test('does not phrase warnings as scanner, camera or print-production claims', () => {
    const plan = generateQRCodePlan({
      type: 'QR_CODE',
      payload: 'https://silverpoint.org',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      lightColor: { r: 0.55, g: 0.55, b: 0.55, a: 1 }
    })
    const combined = plan.scanCheck.warnings.join(' ').toLowerCase()
    expect(combined).not.toContain('scanner')
    expect(combined).not.toContain('camera')
    expect(combined).not.toContain('print')
  })
})

describe('EAN-13 Barcode Generation', () => {
  test('calculates and appends correct check digit for 12 digits', () => {
    // 978020137962 -> check digit is 4 (ISBN-13 example)
    const plan = generateEAN13Plan({
      type: 'EAN_13',
      payload: '978020137962',
      moduleSize: 2,
      barHeight: 80,
      includeText: true,
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })

    expect(plan.type).toBe('EAN_13')
    expect(plan.metadata.payload).toBe('9780201379624')
    expect(plan.info?.checksum).toBe('4')
    expect(plan.scanCheck.status).toBe('PASS')
    // 113 total modules * 2px = 226px width
    expect(plan.width).toBe(113 * 2)

    // Check text child is included
    const textChild = plan.children.find((c) => c.role === 'text')
    expect(textChild).toBeDefined()
    if (textChild && textChild.role === 'text') {
      expect(textChild.text).toContain('9')
      expect(textChild.text).toContain('780201')
      expect(textChild.text).toContain('379624')
    }
  })

  test('validates correct 13-digit input and rejects incorrect check digit', () => {
    // Correct 13 digits
    const plan = generateEAN13Plan({
      type: 'EAN_13',
      payload: '9780201379624',
      moduleSize: 2,
      barHeight: 80,
      includeText: false,
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })
    expect(plan.metadata.payload).toBe('9780201379624')

    // Incorrect 13th digit (e.g. 5 instead of 4)
    expect(() =>
      generateEAN13Plan({
        type: 'EAN_13',
        payload: '9780201379625',
        moduleSize: 2,
        barHeight: 80,
        includeText: false,
        darkColor: { r: 0, g: 0, b: 0, a: 1 },
        lightColor: { r: 1, g: 1, b: 1, a: 1 }
      })
    ).toThrow()
  })

  test('rejects non-digits and invalid lengths', () => {
    const invalidInputs = ['12345', '12345678901234', '978020137962A', '', 'abcdefghijklm']
    for (const invalid of invalidInputs) {
      expect(() =>
        generateEAN13Plan({
          type: 'EAN_13',
          payload: invalid,
          moduleSize: 2,
          barHeight: 80,
          includeText: true,
          darkColor: { r: 0, g: 0, b: 0, a: 1 },
          lightColor: { r: 1, g: 1, b: 1, a: 1 }
        })
      ).toThrow()
    }
  })

  test('toggling human-readable text creates and removes TEXT child', () => {
    const withText = generateEAN13Plan({
      type: 'EAN_13',
      payload: '9780201379624',
      moduleSize: 2,
      barHeight: 80,
      includeText: true,
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })
    expect(withText.children.some((c) => c.role === 'text')).toBe(true)

    const withoutText = generateEAN13Plan({
      type: 'EAN_13',
      payload: '9780201379624',
      moduleSize: 2,
      barHeight: 80,
      includeText: false,
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })
    expect(withoutText.children.some((c) => c.role === 'text')).toBe(false)
  })

  test('reports the real measured contrast ratio, not a placeholder', () => {
    const plan = generateEAN13Plan({
      type: 'EAN_13',
      payload: '978020137962',
      moduleSize: 2,
      barHeight: 80,
      includeText: true,
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })
    expect(plan.scanCheck.contrastRatio).toBeCloseTo(21, 0)
    expect(plan.scanCheck.contrastRatio).not.toBe(0)
  })
})

describe('Barcode geometric scan checks', () => {
  test('checkFiniteDimensions warns on non-finite or non-positive dimensions and passes otherwise', () => {
    const badWarnings: string[] = []
    checkFiniteDimensions(Number.NaN, 100, badWarnings)
    checkFiniteDimensions(100, -5, badWarnings)
    expect(badWarnings.length).toBeGreaterThan(0)

    const goodWarnings: string[] = []
    checkFiniteDimensions(120, 120, goodWarnings)
    expect(goodWarnings).toEqual([])
  })

  test('checkModuleGridConsistency warns when a dimension is not a multiple of the module size', () => {
    const badWarnings: string[] = []
    checkModuleGridConsistency(101, 4, badWarnings, 'Symbol width')
    expect(badWarnings.length).toBe(1)

    const goodWarnings: string[] = []
    checkModuleGridConsistency(100, 4, goodWarnings, 'Symbol width')
    expect(goodWarnings).toEqual([])
  })

  test('checkQuietZoneClear warns when dark geometry intrudes into the quiet zone band', () => {
    const margin = 16 // 4 modules * 4px
    const totalSize = 100

    const intrudingBuilder = createVectorNetworkBuilder()
    intrudingBuilder.addRect(0, 0, 8, 8) // starts inside the quiet zone
    const intrudingWarnings: string[] = []
    checkQuietZoneClear(
      intrudingBuilder.build(),
      margin,
      margin,
      totalSize,
      totalSize,
      intrudingWarnings
    )
    expect(intrudingWarnings.length).toBe(1)

    const cleanBuilder = createVectorNetworkBuilder()
    cleanBuilder.addRect(margin, margin, totalSize - margin * 2, totalSize - margin * 2)
    const cleanWarnings: string[] = []
    checkQuietZoneClear(cleanBuilder.build(), margin, margin, totalSize, totalSize, cleanWarnings)
    expect(cleanWarnings).toEqual([])
  })

  test('checkGuardBarIntegrity warns when a guard pattern does not match the EAN-13 spec and passes for a real plan', () => {
    const plan = generateEAN13Plan({
      type: 'EAN_13',
      payload: '978020137962',
      moduleSize: 2,
      barHeight: 80,
      includeText: false,
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })
    expect(plan.scanCheck.status).toBe('PASS')

    const goodModules = Array.from({ length: 9 + 3 + 42 + 5 + 42 + 3 + 9 }, () => ({
      isDark: false,
      isGuard: false
    }))
    const setGuard = (start: number, pattern: boolean[]) => {
      pattern.forEach((dark, i) => {
        goodModules[start + i] = { isDark: dark, isGuard: true }
      })
    }
    setGuard(9, [true, false, true])
    setGuard(9 + 3 + 42, [false, true, false, true, false])
    setGuard(9 + 3 + 42 + 5 + 42, [true, false, true])

    const passWarnings: string[] = []
    checkGuardBarIntegrity(goodModules, passWarnings)
    expect(passWarnings).toEqual([])

    const brokenModules = goodModules.map((m) => ({ ...m }))
    brokenModules[9] = { isDark: false, isGuard: true } // corrupt the left guard's first bar
    const failWarnings: string[] = []
    checkGuardBarIntegrity(brokenModules, failWarnings)
    expect(failWarnings.length).toBeGreaterThan(0)
  })
})

describe('Scene Graph Barcode Actions', () => {
  test('createBarcode creates frame with role-tagged children and metadata in one undo entry', () => {
    const editor = createEditor()
    const options: QRCodeOptions = {
      type: 'QR_CODE',
      payload: 'https://silverpoint.org',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    }

    const frameId = editor.createBarcode(options)
    const frame = editor.graph.getNode(frameId)
    expect(frame).toBeDefined()
    expect(frame?.type).toBe('FRAME')

    // Metadata check
    const metadata = getBarcodeMetadata(expectDefined(frame, 'barcode frame'))
    expect(metadata).toBeDefined()
    expect(metadata?.type).toBe('QR_CODE')
    expect(metadata?.payload).toBe('https://silverpoint.org')

    // Children check
    const children = editor.graph.getChildren(frameId)
    expect(children).toHaveLength(2)
    const roles = children.map((c) => getPluginData(c, 'barcodeRole'))
    expect(roles).toContain('background')
    expect(roles).toContain('modules')

    // Selection check
    expect([...editor.state.selectedIds]).toEqual([frameId])
    expect(editor.state.activeTool).toBe('SELECT')

    // Undo test: exactly 1 undo entry removes the frame
    expect(editor.undo.canUndo).toBe(true)
    editor.undo.undo()
    expect(editor.graph.getNode(frameId)).toBeUndefined()

    // Redo test
    expect(editor.undo.canRedo).toBe(true)
    editor.undo.redo()
    expect(editor.graph.getNode(frameId)).toBeDefined()
  })

  test('regenerateBarcode updates frame in place preserving identity and layer order', () => {
    const editor = createEditor()
    const frameId = editor.createBarcode({
      type: 'QR_CODE',
      payload: 'Initial QR',
      ecc: 'L',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })

    const initialFrame = getNodeOrThrow(editor.graph, frameId)
    const initialPos = { x: initialFrame.x, y: initialFrame.y }
    const initialParent = initialFrame.parentId

    // Regenerate in place with different style and payload
    editor.regenerateBarcode(frameId, {
      type: 'QR_CODE',
      payload: 'Updated QR Payload',
      ecc: 'H',
      moduleSize: 5,
      style: 'dots',
      darkColor: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
      lightColor: { r: 0.9, g: 0.9, b: 0.9, a: 1 }
    })

    const updatedFrame = getNodeOrThrow(editor.graph, frameId)
    expect(updatedFrame.id).toBe(frameId)
    expect(updatedFrame.x).toBe(initialPos.x)
    expect(updatedFrame.y).toBe(initialPos.y)
    expect(updatedFrame.parentId).toBe(initialParent)

    const updatedMeta = expectDefined(getBarcodeMetadata(updatedFrame), 'updated barcode metadata')
    expect(updatedMeta.payload).toBe('Updated QR Payload')
    expect(updatedMeta.options.ecc).toBe('H')
    expect((updatedMeta.options as QRCodeOptions).style).toBe('dots')

    // Single undo step rolls back to the initial QR state
    editor.undo.undo()
    const rolledBackMeta = expectDefined(
      getBarcodeMetadata(getNodeOrThrow(editor.graph, frameId)),
      'rolled back barcode metadata'
    )
    expect(rolledBackMeta.payload).toBe('Initial QR')
  })

  test('detects conflict on user-added child layers and rejects mutation', () => {
    const editor = createEditor()
    const frameId = editor.createBarcode({
      type: 'QR_CODE',
      payload: 'https://silverpoint.org',
      ecc: 'M',
      moduleSize: 4,
      style: 'square',
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })

    // Add an arbitrary non-role user shape into the barcode frame
    const userRect = editor.graph.createNode('RECTANGLE', frameId, {
      name: 'My Custom Logo',
      x: 10,
      y: 10,
      width: 20,
      height: 20
    })

    // Conflict detection should flag it
    const conflict = hasBarcodeConflict(editor, frameId)
    expect(conflict).toBeDefined()
    expect(conflict).toContain('My Custom Logo')

    // Regeneration should throw and change nothing
    expect(() =>
      editor.regenerateBarcode(frameId, {
        type: 'QR_CODE',
        payload: 'Attempted Update',
        ecc: 'M',
        moduleSize: 4,
        style: 'square',
        darkColor: { r: 0, g: 0, b: 0, a: 1 },
        lightColor: { r: 1, g: 1, b: 1, a: 1 }
      })
    ).toThrow()

    // User layer is preserved untouched
    expect(editor.graph.getNode(userRect.id)).toBeDefined()
    expect(getBarcodeMetadata(getNodeOrThrow(editor.graph, frameId))?.payload).toBe('https://silverpoint.org')
  })

  test('survives .fig export and import roundtrip with metadata and editability intact', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const editor = createEditor({ graph })

    editor.createBarcode({
      type: 'QR_CODE',
      payload: 'https://silverpoint.org/docs',
      ecc: 'Q',
      moduleSize: 4,
      style: 'rounded',
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })

    editor.createBarcode({
      type: 'EAN_13',
      payload: '978020137962',
      moduleSize: 2,
      barHeight: 80,
      includeText: true,
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    })

    const bytes = await exportFigFile(graph)
    const parsedGraph = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )

    const parsedQR = [...parsedGraph.getAllNodes()].find((n) => n.name === 'QR Code')
    const parsedEAN = [...parsedGraph.getAllNodes()].find((n) => n.name === 'EAN-13 Barcode')

    expect(parsedQR).toBeDefined()
    expect(parsedEAN).toBeDefined()

    const qrMeta = getBarcodeMetadata(expectDefined(parsedQR, 'parsed QR frame'))
    const eanMeta = getBarcodeMetadata(expectDefined(parsedEAN, 'parsed EAN frame'))

    expect(qrMeta).toBeDefined()
    expect(qrMeta?.payload).toBe('https://silverpoint.org/docs')
    expect(qrMeta?.options.ecc).toBe('Q')

    expect(eanMeta).toBeDefined()
    expect(eanMeta?.payload).toBe('9780201379624')

    // Children are also preserved
    const qrChildren = parsedGraph.getChildren(expectDefined(parsedQR, 'parsed QR frame').id)
    expect(qrChildren).toHaveLength(2)
    expect(getPluginData(qrChildren[0], 'barcodeRole')).toBeDefined()
  })
})
