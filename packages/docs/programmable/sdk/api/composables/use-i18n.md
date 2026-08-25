---
title: useI18n
description: Read OpenPencil UI messages and access locale state in the SDK.
---

# useI18n

`useI18n()` returns reactive message groups plus locale controls for OpenPencil-powered editor shells.

Silverpoint ships a single English locale. These exports exist for custom shells and SDK message access.

## Usage

```ts
import { useI18n } from '@open-pencil/vue'

const { menu, commands, panels, locale, availableLocales, localeLabels, setLocale } = useI18n()
```

## Returns

- `menu`
- `commands`
- `tools`
- `panels`
- `pages`
- `dialogs`
- `locale`
- `availableLocales`
- `localeLabels`
- `setLocale`

## Basic example

```vue
<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

const { menu, panels } = useI18n()
</script>

<template>
  <div>
    <span>{{ menu.view }}</span>
    <span>{{ panels.layers }}</span>
  </div>
</template>
```

## Notes

- Silverpoint ships a single English locale (`'en'`); `availableLocales` contains `['en']`
- the SDK also exports lower-level locale primitives when you need direct store access

## Related APIs

- [useMenuModel](./use-menu-model)
- [SDK Locale APIs](../advanced/locale-apis)
