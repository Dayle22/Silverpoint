# IDML Package Structure and Specification Reference

This document records the binding IDML schema specification and package structure used by Silverpoint's IDML exporter (T-063) and importer (T-064).

## 1. Package Container Format (UCF)

An IDML file is a ZIP archive conforming to the Adobe Universal Container Format.

### Entry Requirements
1. **`mimetype`**:
   - Must be the **first entry** in the ZIP archive.
   - Must be stored **uncompressed** (compression level 0).
   - Content: `application/vnd.adobe.indesign-idml-package` (exact ASCII string, 48 bytes, no trailing newline).
2. **`META-INF/container.xml`**:
   - Identifies the root manifest file of the package (`designmap.xml`).
3. **`designmap.xml`**:
   - The central document map and root element.
4. **All paths use forward slashes (`/`)**, even when created on Windows.

### `META-INF/container.xml` Structure
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="designmap.xml" media-type="text/xml"/>
  </rootfiles>
</container>
```

---

## 2. XML Namespaces and Document Root

- **`idPkg` Namespace**: `http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging`
- **DOMVersion**: `8.0` (InDesign CS6+ interchange baseline, natively compatible with all modern InDesign versions and Affinity Publisher).

### `designmap.xml` Structure
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0" Self="d" StoryList="story_1 story_2" Name="Silverpoint Document" ZeroPoint="0 0">
  <idPkg:Graphic src="Resources/Graphic.xml"/>
  <idPkg:Fonts src="Resources/Fonts.xml"/>
  <idPkg:Styles src="Resources/Styles.xml"/>
  <idPkg:Preferences src="Resources/Preferences.xml"/>
  <idPkg:MasterSpread src="MasterSpreads/MasterSpread_m1.xml"/>
  <idPkg:Spread src="Spreads/Spread_s1.xml"/>
  <idPkg:Story src="Stories/Story_story_1.xml"/>
  <idPkg:Story src="Stories/Story_story_2.xml"/>
</Document>
```

---

## 3. Resources

### `Resources/Preferences.xml`
Defines default page dimensions, document facing pages setting, and default document bleed offsets.
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Preferences xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0">
  <DocumentPreference PageWidth="400" PageHeight="300" PagesPerDocument="1" FacingPages="false" DocumentBleedTopOffset="0" DocumentBleedBottomOffset="0" DocumentBleedInsideOrLeftOffset="0" DocumentBleedOutsideOrRightOffset="0"/>
</idPkg:Preferences>
```

### `Resources/Graphic.xml`
Defines deterministic solid RGB color swatches. Color values are integer space-separated `0..255` values (`R G B`).
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Graphic xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0">
  <Color Self="Color/Black" Model="Process" Space="RGB" ColorValue="0 0 0" ColorOverride="false" Name="Black"/>
  <Color Self="Color/White" Model="Process" Space="RGB" ColorValue="255 255 255" ColorOverride="false" Name="White"/>
  <Color Self="Color/C_R32_G64_B128" Model="Process" Space="RGB" ColorValue="32 64 128" ColorOverride="false" Name="C_R32_G64_B128"/>
</idPkg:Graphic>
```

### `Resources/Fonts.xml`
Defines font families referenced by text stories.
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Fonts xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0">
  <FontFamily Name="Inter">
    <Font Name="Inter Regular" PostScriptName="Inter-Regular" Status="Installed"/>
  </FontFamily>
</idPkg:Fonts>
```

### `Resources/Styles.xml`
Defines root paragraph and character style groups and default style entries.
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0">
  <RootParagraphStyleGroup Self="RootParagraphStyleGroup">
    <ParagraphStyle Self="ParagraphStyle/$ID/[No Paragraph Style]" Name="$ID/[No Paragraph Style]"/>
  </RootParagraphStyleGroup>
  <RootCharacterStyleGroup Self="RootCharacterStyleGroup">
    <CharacterStyle Self="CharacterStyle/$ID/[No Character Style]" Name="$ID/[No Character Style]"/>
  </RootCharacterStyleGroup>
</idPkg:Styles>
```

---

## 4. Master Spreads and Spreads

### `MasterSpreads/MasterSpread_m1.xml`
One default master spread required by InDesign.
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:MasterSpread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0">
  <MasterSpread Self="m1" Name="A-Master" NamePrefix="A" BaseName="Master" PageCount="1">
    <Page Self="m1_p1" GeometricBounds="0 0 300 400" ItemTransform="1 0 0 1 0 0" Name="A"/>
  </MasterSpread>
</idPkg:MasterSpread>
```

### `Spreads/Spread_s*.xml`
Each exported frame produces one spread with one page.
- **`GeometricBounds`**: `[top left bottom right]` format in points (`0 0 height width`).
- **`ItemTransform`**: Standard affine transformation matrix `a b c d tx ty` mapping inner item coordinates to spread coordinates: `1 0 0 1 x y`.
- **`MarginPreference`**: `Top`, `Bottom`, `Left`, `Right` in points from frame guides.

#### Page items:
- **`<Rectangle>`**:
  ```xml
  <Rectangle Self="rect_1" ItemTransform="1 0 0 1 20 20" GeometricBounds="0 0 80 130" FillColor="Color/C_R32_G64_B128" StrokeColor="Color/Black" StrokeWeight="1">
    <Properties>
      <PathGeometry>
        <GeometryPathType PathOpen="false">
          <PathPointArray>
            <PathPointType Anchor="0 0" LeftDirection="0 0" RightDirection="0 0"/>
            <PathPointType Anchor="130 0" LeftDirection="130 0" RightDirection="130 0"/>
            <PathPointType Anchor="130 80" LeftDirection="130 80" RightDirection="130 80"/>
            <PathPointType Anchor="0 80" LeftDirection="0 80" RightDirection="0 80"/>
          </PathPointArray>
        </GeometryPathType>
      </PathGeometry>
    </Properties>
  </Rectangle>
  ```
- **`<Oval>`** (Ellipses):
  4 Bezier control points using `kappa = 0.5522847498307935`.
- **`<Polygon>`** (Polygons, Stars, Vectors, Booleans):
  `PathGeometry` with arbitrary points from node geometry.
- **`<TextFrame>`**:
  Linked to `ParentStory="story_*"`.
- **`<Group>`**:
  Container for nested frames or groups.
- **`<Image>`**:
  Embedded base64 content:
  ```xml
  <Image Self="img_1" ImageTypeName="$ID/PNG" ItemTransform="1 0 0 1 0 0" GeometricBounds="0 0 80 130">
    <Contents><![CDATA[...base64 data...]]></Contents>
  </Image>
  ```

---

## 5. Stories

### `Stories/Story_*.xml`
Contains editable text runs, typography styling, paragraph justification, font families, and colors.
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0">
  <Story Self="story_1" UserText="true">
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/[No Paragraph Style]" Justification="LeftAlign">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No Character Style]" AppliedFont="Inter" FontStyle="Regular" PointSize="14" FillColor="Color/Black">
        <Content>Silverpoint IDML Export Text</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
  </Story>
</idPkg:Story>
```

---

## 6. Dialect Differences: InDesign vs Affinity Publisher vs Silverpoint

1. **Spread & Story File Naming**:
   - InDesign uses `Spreads/Spread_s[N].xml` and `Stories/Story_story_[N].xml` or `Story_u[hex].xml`.
   - Affinity Publisher may use `Spreads/Spread_[N].xml` and `Stories/Story_aff_[N].xml` or `Story_[N].xml`.
   - Silverpoint importer resolves all referenced parts generically via `designmap.xml` with automatic directory glob fallback.

2. **Color Swatches and Color Spaces**:
   - InDesign uses `Space="RGB"` with 0..255 space-separated values, and `Space="CMYK"` with 0..100 percentages.
   - Affinity Publisher also exports `Space="RGB"` and `Space="CMYK"` swatches with `ColorOverride="false"` or omitted attributes.
   - Silverpoint converts CMYK values to calibrated RGB approximations using standard subtractive formulas `(1-C)*(1-K)` and emits an informational diagnostic.

3. **Master Spreads**:
   - InDesign attaches default `AppliedMaster="m1"` or master page keys to Spreads.
   - Master page contents are flattened into inheriting frames upon import, tagged with `idmlMasterItem` in `pluginData` to avoid duplicate exports.

4. **Geometry & Transformations**:
   - Both tools represent transformations with 6-element affine matrices in `ItemTransform="a b c d tx ty"`.
   - Rotations and translations are mapped directly to Silverpoint node positions and degree rotations. Any skew component is decomposed to rotation with a warning diagnostic.
