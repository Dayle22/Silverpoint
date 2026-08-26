/* eslint-disable max-lines -- comprehensive NodeChange import coverage */
import { describe, expect, test } from 'bun:test'

import type { NodeChange, Paint } from '@open-pencil/kiwi/fig/codec'

import {
  applyStyleRefsToFields,
  buildStyleOverrideTable,
  convertEffects,
  convertFills,
  convertFontFeatures,
  convertLetterSpacing,
  convertLineHeight,
  convertStrokes,
  decodeVectorNetworkBlob,
  encodePathCommandsBlob,
  encodeVectorNetworkBlob,
  mapTextDecoration,
  nodeChangeToProps,
  setVariableColorResolver
} from '../src/node-change'

describe('@open-pencil/fig NodeChange policy', () => {
  test('converts normalized text values', () => {
    expect(convertLineHeight({ value: 120, units: 'PERCENT' }, 20)).toBe(24)
    expect(convertLetterSpacing({ value: 10, units: 'PERCENT' }, 20)).toBe(2)
    expect(mapTextDecoration('UNDERLINE')).toBe('UNDERLINE')
  })

  test('converts Figma OpenType feature toggles', () => {
    expect(
      convertFontFeatures({
        toggledOnOTFeatures: ['DLIG'],
        toggledOffOTFeatures: ['LIGA']
      })
    ).toEqual([
      { tag: 'DLIG', enabled: true },
      { tag: 'LIGA', enabled: false }
    ])
  })

  test('normalizes imported paints and effects', () => {
    expect(convertFills([{ type: 'SOLID' }])[0]).toMatchObject({
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    })
    expect(convertEffects([{ type: 'DROP_SHADOW' }])[0]).toMatchObject({
      type: 'DROP_SHADOW',
      radius: 0,
      visible: true
    })
  })

  test('preserves the translation of rotated and mirrored Figma instances', () => {
    const props = nodeChangeToProps(
      {
        type: 'INSTANCE',
        size: { x: 955, y: 95.99996185302734 },
        transform: {
          m00: -4.371139183945161e-8,
          m01: -1,
          m02: 2326,
          m10: -1,
          m11: 4.371139183945161e-8,
          m12: 2254
        }
      } as NodeChange,
      []
    )

    expect(props.rotation).toBeCloseTo(-90, 5)
    expect(props.flipX).toBe(true)
    expect(props.x).toBeCloseTo(1800.5, 4)
    expect(props.y).toBeCloseTo(1728.5, 4)
  })

  const reflectedTransforms: Array<{
    name: string
    transform: NonNullable<NodeChange['transform']>
    rotation: number
  }> = [
    {
      name: 'horizontal reflection',
      transform: { m00: -1, m01: 0, m02: 400, m10: 0, m11: 1, m12: 200 },
      rotation: 0
    },
    {
      name: 'vertical reflection represented as a rotated horizontal reflection',
      transform: { m00: 1, m01: 0, m02: 400, m10: 0, m11: -1, m12: 200 },
      rotation: 180
    },
    {
      name: 'negative quarter-turn reflection',
      transform: { m00: 0, m01: -1, m02: 400, m10: -1, m11: 0, m12: 200 },
      rotation: -90
    },
    {
      name: 'positive quarter-turn reflection',
      transform: { m00: 0, m01: 1, m02: 400, m10: 1, m11: 0, m12: 200 },
      rotation: 90
    }
  ]

  test.each(reflectedTransforms)('reconstructs $name matrices', ({ transform, rotation }) => {
    const width = 120
    const height = 80
    const props = nodeChangeToProps(
      { type: 'INSTANCE', size: { x: width, y: height }, transform } as NodeChange,
      []
    )

    expect(props.rotation).toBeCloseTo(rotation, 5)
    expect(props.flipX).toBe(true)

    const actualRotation = props.rotation ?? 0
    const x = props.x ?? 0
    const y = props.y ?? 0
    const radians = (actualRotation * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const centerX = width / 2
    const centerY = height / 2
    expect(-cos).toBeCloseTo(transform.m00, 5)
    expect(sin).toBeCloseTo(transform.m01, 5)
    expect(sin).toBeCloseTo(transform.m10, 5)
    expect(cos).toBeCloseTo(transform.m11, 5)
    expect(x + centerX - (-cos * centerX + sin * centerY)).toBeCloseTo(transform.m02, 5)
    expect(y + centerY - (sin * centerX + cos * centerY)).toBeCloseTo(transform.m12, 5)
  })

  test('keeps resolved variable alpha in paint opacity', () => {
    setVariableColorResolver(() => ({ r: 1, g: 0, b: 0, a: 0.4 }))
    try {
      const paint: Paint = {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        colorVar: { value: { alias: { guid: { sessionID: 1, localID: 2 } } } }
      }
      expect(convertFills([paint])[0]).toMatchObject({
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 0.4
      })
      expect(convertStrokes([paint])[0]).toMatchObject({
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 0.4
      })
    } finally {
      setVariableColorResolver(null)
    }
  })

  test('uses vector-region winding rules for rendered geometry', () => {
    const network = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' as const },
        { x: 10, y: 0, handleMirroring: 'NONE' as const },
        { x: 0, y: 10, handleMirroring: 'NONE' as const }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        },
        {
          start: 1,
          end: 2,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        },
        {
          start: 2,
          end: 0,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        }
      ],
      regions: [{ windingRule: 'EVENODD' as const, loops: [[0, 1, 2]] }]
    }
    const props = nodeChangeToProps(
      {
        type: 'VECTOR',
        fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: 0 }],
        vectorData: { vectorNetworkBlob: 1 }
      } as NodeChange,
      [
        encodePathCommandsBlob([
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 10, y: 0 },
          { type: 'L', x: 0, y: 10 },
          { type: 'Z' }
        ]),
        encodeVectorNetworkBlob(network)
      ]
    )

    expect(props.fillGeometry?.[0]?.windingRule).toBe('EVENODD')
  })

  test('round-trips vector network blobs with handle mirroring', () => {
    const network = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'ANGLE' as const },
        { x: 10, y: 0, handleMirroring: 'NONE' as const }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        }
      ],
      regions: []
    }
    const { table, mirroringToId } = buildStyleOverrideTable(network)
    expect(decodeVectorNetworkBlob(encodeVectorNetworkBlob(network, mirroringToId), table)).toEqual(
      network
    )
  })

  test('resolves imported style references before SceneGraph conversion', () => {
    const fields: Record<string, unknown> = {
      styleIdForFill: { guid: { sessionID: 2, localID: 3 } }
    }
    applyStyleRefsToFields(
      new Map([
        [
          '2:3',
          {
            type: 'RECTANGLE',
            styleType: 'FILL',
            fillPaints: [{ type: 'SOLID', visible: true }]
          }
        ]
      ]),
      fields
    )
    expect(fields.fillPaints).toEqual([{ type: 'SOLID', visible: true }])
  })

  test('nodeChangeToProps maps auto-layout, constraints, dimensions, corner properties, and styles', () => {
    const nc: NodeChange = {
      guid: { sessionID: 10, localID: 20 },
      type: 'FRAME',
      name: 'Card Container',
      size: { x: 400, y: 300 },
      minSize: { value: { x: 200, y: 150 } },
      maxSize: { value: { x: 800, y: 600 } },
      transform: { m00: 1, m01: 0, m02: 50, m10: 0, m11: 1, m12: 100 },
      opacity: 0.9,
      visible: true,
      locked: false,
      blendMode: 'MULTIPLY',
      cornerRadius: 12,
      rectangleTopLeftCornerRadius: 16,
      rectangleTopRightCornerRadius: 16,
      rectangleBottomRightCornerRadius: 8,
      rectangleBottomLeftCornerRadius: 8,
      rectangleCornerRadiiIndependent: true,
      cornerSmoothing: 0.6,
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'CENTER',
      stackMode: 'VERTICAL',
      stackSpacing: 16,
      stackPadding: 24,
      stackVerticalPadding: 20,
      stackPaddingBottom: 28,
      stackHorizontalPadding: 18,
      stackPaddingRight: 22,
      stackPrimarySizing: 'RESIZE_TO_FIT',
      stackCounterSizing: 'FILL',
      stackPrimaryAlignItems: 'CENTER',
      stackCounterAlignItems: 'STRETCH',
      stackWrap: 'WRAP',
      stackCounterSpacing: 8,
      stackReverseZIndex: true,
      strokesIncludedInLayout: true,
      mask: true,
      maskType: 'VECTOR',
      maskIsOutline: true,
      layoutGrids: [{ pattern: 'COLUMNS', sectionSize: 60, count: 4 }],
      guides: [{ axis: 'X', offset: 120, guid: { sessionID: 10, localID: 99 } }],
      styleIdForFill: { guid: { sessionID: 10, localID: 301 } },
      styleIdForStrokeFill: { guid: { sessionID: 10, localID: 302 } },
      styleIdForText: { guid: { sessionID: 10, localID: 303 } },
      styleIdForEffect: { guid: { sessionID: 10, localID: 304 } },
      styleIdForGrid: { guid: { sessionID: 10, localID: 305 } },
      styleType: 'FILL',
      variableConsumptionMap: {
        entries: [
          {
            variableField: 'CORNER_RADIUS',
            variableData: {
              value: {
                alias: {
                  guid: { sessionID: 10, localID: 401 }
                }
              }
            }
          }
        ]
      },
      variableModeBySetMap: {
        entries: [
          {
            variableSetID: { guid: { sessionID: 10, localID: 501 } },
            variableModeID: { sessionID: 10, localID: 502 }
          }
        ]
      }
    } as NodeChange

    const props = nodeChangeToProps(nc, [])

    expect(props.nodeType).toBe('FRAME')
    expect(props.name).toBe('Card Container')
    expect(props.x).toBe(50)
    expect(props.y).toBe(100)
    expect(props.width).toBe(400)
    expect(props.height).toBe(300)
    expect(props.minWidth).toBe(200)
    expect(props.minHeight).toBe(150)
    expect(props.maxWidth).toBe(800)
    expect(props.maxHeight).toBe(600)
    expect(props.opacity).toBe(0.9)
    expect(props.blendMode).toBe('MULTIPLY')
    expect(props.cornerRadius).toBe(12)
    expect(props.topLeftRadius).toBe(16)
    expect(props.topRightRadius).toBe(16)
    expect(props.bottomRightRadius).toBe(8)
    expect(props.bottomLeftRadius).toBe(8)
    expect(props.independentCorners).toBe(true)
    expect(props.cornerSmoothing).toBe(0.6)
    expect(props.horizontalConstraint).toBe('STRETCH')
    expect(props.verticalConstraint).toBe('CENTER')
    expect(props.layoutMode).toBe('VERTICAL')
    expect(props.itemSpacing).toBe(16)
    expect(props.paddingTop).toBe(20)
    expect(props.paddingBottom).toBe(28)
    expect(props.paddingLeft).toBe(18)
    expect(props.paddingRight).toBe(22)
    expect(props.primaryAxisSizing).toBe('HUG')
    expect(props.counterAxisSizing).toBe('FILL')
    expect(props.primaryAxisAlign).toBe('CENTER')
    expect(props.counterAxisAlign).toBe('STRETCH')
    expect(props.layoutWrap).toBe('WRAP')
    expect(props.counterAxisSpacing).toBe(8)
    expect(props.itemReverseZIndex).toBe(true)
    expect(props.strokesIncludedInLayout).toBe(true)
    expect(props.isMask).toBe(true)
    expect(props.maskType).toBe('VECTOR')
    expect(props.maskIsOutline).toBe(true)
    expect(props.layoutGrids).toHaveLength(1)
    expect(props.guides).toHaveLength(1)
    expect(props.guides?.[0]).toMatchObject({ axis: 'x', position: 120, id: 'fig-guide:10:99' })
    expect(props.fillStyleId).toBe('10:301')
    expect(props.strokeStyleId).toBe('10:302')
    expect(props.textStyleId).toBe('10:303')
    expect(props.effectStyleId).toBe('10:304')
    expect(props.gridStyleId).toBe('10:305')
    expect(props.sharedStyleType).toBe('FILL')
    expect(props.boundVariables?.['cornerRadius']).toBe('10:401')
    expect(props.variableModes?.['10:501']).toBe('10:502')
  })

  test('nodeChangeToProps maps component property definitions, references, assignments, and values', () => {
    const nc: NodeChange = {
      guid: { sessionID: 1, localID: 100 },
      type: 'SYMBOL',
      name: 'Button Component',
      componentPropDefs: [
        {
          id: { sessionID: 1, localID: 101 },
          name: 'Label',
          type: 'TEXT',
          initialValue: { textValue: 'Click me' }
        },
        {
          id: { sessionID: 1, localID: 102 },
          name: 'HasIcon',
          type: 'BOOL',
          initialValue: { boolValue: true }
        },
        {
          id: { sessionID: 1, localID: 103 },
          name: 'Variant',
          type: 'VARIANT',
          initialValue: { textValue: 'Primary' },
          preferredValues: {
            stringValues: ['Primary', 'Secondary', 'Ghost']
          }
        },
        {
          id: { sessionID: 1, localID: 104 },
          name: 'IconSwap',
          type: 'INSTANCE_SWAP',
          initialValue: { guidValue: { sessionID: 1, localID: 200 } },
          preferredValues: {
            instanceSwapValues: [{ key: 'icon/arrow' }, { key: 'icon/check' }]
          }
        }
      ],
      componentPropRefs: [
        {
          defID: { sessionID: 1, localID: 101 },
          componentPropNodeField: 'TEXT_DATA',
          isDeleted: false
        },
        {
          defID: { sessionID: 1, localID: 102 },
          componentPropNodeField: 'VISIBLE',
          isDeleted: false
        }
      ],
      componentPropAssignments: [
        {
          defID: { sessionID: 1, localID: 101 },
          value: { textValue: 'Submit' }
        }
      ],
      variantPropSpecs: [
        {
          propDefId: { sessionID: 1, localID: 103 },
          value: 'Secondary'
        }
      ]
    } as NodeChange

    const props = nodeChangeToProps(nc, [])

    expect(props.nodeType).toBe('COMPONENT')
    expect(props.componentPropertyDefinitions).toHaveLength(4)
    expect(props.componentPropertyDefinitions?.[0]).toMatchObject({
      id: '1:101',
      name: 'Label',
      type: 'TEXT',
      defaultValue: 'Click me'
    })
    expect(props.componentPropertyDefinitions?.[2]).toMatchObject({
      id: '1:103',
      name: 'Variant',
      type: 'VARIANT',
      defaultValue: 'Primary',
      variantOptions: ['Primary', 'Secondary', 'Ghost']
    })
    expect(props.componentPropertyDefinitions?.[3]).toMatchObject({
      id: '1:104',
      name: 'IconSwap',
      type: 'INSTANCE_SWAP',
      defaultValue: '1:200',
      preferredValues: ['icon/arrow', 'icon/check']
    })
    expect(props.componentPropertyReferences).toEqual([
      { propertyId: '1:101', field: 'TEXT' },
      { propertyId: '1:102', field: 'VISIBLE' }
    ])
    expect(props.componentPropertyAssignments).toEqual({
      '1:101': 'Submit'
    })
    expect(props.componentPropertyValues).toEqual({
      Variant: 'Secondary'
    })
  })

  test('nodeChangeToProps maps text properties and style runs', () => {
    const nc: NodeChange = {
      type: 'TEXT',
      textData: {
        characters: 'Hello World',
        styleOverrideTable: [
          {
            styleID: 1,
            fontSize: 24,
            fontName: { family: 'Inter', style: 'Regular' }
          }
        ],
        characterStyleIDs: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]
      },
      fontSize: 18,
      fontName: { family: 'Inter', style: 'Bold Italic' },
      textAlignHorizontal: 'CENTER',
      textAlignVertical: 'MIDDLE',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      textCase: 'UPPER',
      textDecoration: 'UNDERLINE',
      textDecorationStyle: 'SOLID',
      leadingTrim: 'CAP_HEIGHT',
      lineHeight: { value: 24, units: 'PIXELS' },
      letterSpacing: { value: 5, units: 'PERCENT' },
      textTruncation: 'ENDING'
    } as NodeChange

    const props = nodeChangeToProps(nc, [])

    expect(props.nodeType).toBe('TEXT')
    expect(props.text).toBe('Hello World')
    expect(props.fontSize).toBe(18)
    expect(props.fontFamily).toBe('Inter')
    expect(props.fontWeight).toBe(700)
    expect(props.italic).toBe(true)
    expect(props.textAlignHorizontal).toBe('CENTER')
    expect(props.textAlignVertical).toBe('MIDDLE')
    expect(props.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(props.textCase).toBe('UPPER')
    expect(props.textDecoration).toBe('UNDERLINE')
    expect(props.leadingTrim).toBe('CAP_HEIGHT')
    expect(props.lineHeight).toBe(24)
    expect(props.letterSpacing).toBeCloseTo(0.9, 3)
    expect(props.textTruncation).toBe('ENDING')
    expect(props.styleRuns).toHaveLength(1)
    expect(props.styleRuns?.[0]).toMatchObject({
      start: 5,
      length: 6,
      style: {
        fontSize: 24,
        fontFamily: 'Inter',
        fontWeight: 400,
        italic: false
      }
    })
  })

  test('nodeChangeToProps distinguishes plain groups from auto-layout hug frames and resolves boolean operations', () => {
    const plainGroup = nodeChangeToProps(
      {
        type: 'FRAME',
        resizeToFit: true,
        size: { x: 100, y: 100 }
      } as NodeChange,
      []
    )
    expect(plainGroup.nodeType).toBe('GROUP')

    const hugFrame = nodeChangeToProps(
      {
        type: 'FRAME',
        resizeToFit: true,
        stackMode: 'HORIZONTAL',
        stackPrimarySizing: 'RESIZE_TO_FIT',
        size: { x: 100, y: 100 }
      } as NodeChange,
      []
    )
    expect(hugFrame.nodeType).toBe('FRAME')

    const boolSubtract = nodeChangeToProps(
      {
        type: 'BOOLEAN_OPERATION',
        booleanOperation: 'SUBTRACT'
      } as NodeChange,
      []
    )
    expect(boolSubtract.nodeType).toBe('BOOLEAN_OPERATION')
    expect(boolSubtract.booleanOperation).toBe('SUBTRACT')
  })

  test('nodeChangeToProps preserves d1a curved gradient and custom effect payloads over lossy carrier conversion', () => {
    const curvedSpine = [
      { t: 0.25, offset: 12 },
      { t: 0.75, offset: -8 }
    ]
    const customEffectStack = [
      {
        kind: 'native',
        index: 0,
        blurType: 'PROGRESSIVE',
        startRadius: 4,
        startOffset: { x: 0, y: 0.1 },
        endOffset: { x: 1, y: 0.9 }
      },
      {
        kind: 'noise',
        visible: true,
        radius: 2,
        color: { r: 0, g: 0, b: 0, a: 0.5 },
        blendMode: 'OVERLAY'
      },
      {
        kind: 'adjustment',
        type: 'BRIGHTNESS_CONTRAST',
        visible: true,
        brightness: 15,
        contrast: -10
      }
    ]

    const nc: NodeChange = {
      type: 'RECTANGLE',
      size: { x: 200, y: 200 },
      fillPaints: [
        {
          type: 'GRADIENT_LINEAR',
          stops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          visible: true
        }
      ],
      effects: [
        {
          type: 'FOREGROUND_BLUR',
          radius: 10,
          visible: true
        }
      ],
      pluginData: [
        {
          pluginID: 'open-pencil',
          key: 'curvedGradientFillsV1',
          value: JSON.stringify({
            version: 1,
            byIndex: {
              '0': curvedSpine
            }
          })
        },
        {
          pluginID: 'open-pencil',
          key: 'adjustmentEffectStackV1',
          value: JSON.stringify({
            version: 1,
            stack: customEffectStack
          })
        }
      ]
    } as NodeChange

    const props = nodeChangeToProps(nc, [])

    // Proves curved gradient was restored over standard linear carrier
    const fills = props.fills ?? []
    expect(fills).toHaveLength(1)
    expect(fills[0].type).toBe('GRADIENT_CURVED')
    expect(fills[0].gradientSpine).toEqual(curvedSpine)

    // Proves custom adjustment effect stack was restored over native Figma effects
    const effects = props.effects ?? []
    expect(effects).toHaveLength(3)
    const [blur, noise, adjust] = effects
    expect(blur.type).toBe('FOREGROUND_BLUR')
    expect(blur.blurType).toBe('PROGRESSIVE')
    expect(blur.startRadius).toBe(4)
    expect(blur.startOffset).toEqual({ x: 0, y: 0.1 })
    expect(noise.type).toBe('NOISE')
    expect(noise.radius).toBe(2)
    expect(noise.blendMode).toBe('OVERLAY')
    expect(adjust.type).toBe('BRIGHTNESS_CONTRAST')
    expect(adjust.brightness).toBe(15)
    expect(adjust.contrast).toBe(-10)
  })
})
