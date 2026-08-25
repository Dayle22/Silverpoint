<script setup lang="ts">
import { ref } from 'vue'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'

import IconChevronRight from '~icons/lucide/chevron-right'

import { useI18n, vTestId } from '@open-pencil/vue'
import AppShortcutText from '@/components/ui/AppShortcutText.vue'
import { useMenuUI } from '@/components/ui/menu'
import { useAppMenu } from '@/app/shell/menu/app-menu'
import {
  hasMenuSubItems,
  isMenuCheckbox,
  isMenuSeparator,
  menuChecked,
  menuDisabled,
  menuLabel,
  menuShortcut,
  menuSubItems,
  runMenuAction,
  updateMenuChecked
} from '@/app/shell/menu/entry'

const { menu: t } = useI18n()
const { topMenus } = useAppMenu()

const menuOpen = ref(false)

const rootMenuCls = useMenuUI({ content: 'min-w-40' })
const menuCls = useMenuUI()
const mainMenuCls = useMenuUI({ content: 'min-w-52' })
const subMenuCls = useMenuUI({ content: 'min-w-44' })
</script>

<template>
  <DropdownMenuRoot v-model:open="menuOpen">
    <DropdownMenuTrigger as-child>
      <button
        data-test-id="app-icon-menu-trigger"
        class="flex size-9 shrink-0 cursor-pointer items-center justify-center border-r border-border text-muted transition-colors hover:text-surface data-[state=open]:bg-panel data-[state=open]:text-surface"
        :aria-label="t.mainMenu"
      >
        <img src="/favicon-32.png" class="size-4" alt="OpenPencil" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent :side-offset="4" align="start" :class="rootMenuCls.content">
        <DropdownMenuSub v-for="menu in topMenus" :key="menu.label">
          <DropdownMenuSubTrigger
            v-test-id="`app-menu-group-${menu.label.toLowerCase()}`"
            :class="menuCls.item"
          >
            <span class="flex-1">{{ menu.label }}</span>
            <IconChevronRight class="size-3 text-muted" />
          </DropdownMenuSubTrigger>

          <DropdownMenuPortal>
            <DropdownMenuSubContent :side-offset="4" :class="mainMenuCls.content">
              <template v-for="(item, i) in menu.items" :key="i">
                <DropdownMenuSeparator v-if="isMenuSeparator(item)" :class="menuCls.separator" />
                <DropdownMenuSub v-else-if="hasMenuSubItems(item)">
                  <DropdownMenuSubTrigger :class="menuCls.item">
                    <span class="flex-1">{{ menuLabel(item) }}</span>
                    <IconChevronRight class="size-3 text-muted" />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent :side-offset="4" :class="subMenuCls.content">
                      <template v-for="(sub, j) in menuSubItems(item)" :key="j">
                        <DropdownMenuSeparator v-if="isMenuSeparator(sub)" :class="menuCls.separator" />
                        <DropdownMenuCheckboxItem
                          v-else-if="isMenuCheckbox(sub)"
                          :model-value="menuChecked(sub)"
                          :class="menuCls.item"
                          @update:model-value="updateMenuChecked(sub, $event as boolean)"
                        >
                          <span class="flex-1">{{ menuLabel(sub) }}</span>
                          <DropdownMenuItemIndicator class="text-surface">
                            <icon-lucide-check class="size-3.5" />
                          </DropdownMenuItemIndicator>
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuItem
                          v-else
                          :class="menuCls.item"
                          :disabled="menuDisabled(sub)"
                          @select="runMenuAction(sub)"
                        >
                          <span class="flex-1">{{ menuLabel(sub) }}</span>
                          <AppShortcutText v-if="menuShortcut(sub)">{{
                            menuShortcut(sub)
                          }}</AppShortcutText>
                        </DropdownMenuItem>
                      </template>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuCheckboxItem
                  v-else-if="isMenuCheckbox(item)"
                  :model-value="menuChecked(item)"
                  :class="menuCls.item"
                  @update:model-value="updateMenuChecked(item, $event as boolean)"
                >
                  <span class="flex-1">{{ menuLabel(item) }}</span>
                  <DropdownMenuItemIndicator class="text-surface">
                    <icon-lucide-check class="size-3.5" />
                  </DropdownMenuItemIndicator>
                </DropdownMenuCheckboxItem>
                <DropdownMenuItem
                  v-else
                  :class="menuCls.item"
                  :disabled="menuDisabled(item)"
                  @select="runMenuAction(item)"
                >
                  <span class="flex-1">{{ menuLabel(item) }}</span>
                  <AppShortcutText v-if="menuShortcut(item)">{{
                    menuShortcut(item)
                  }}</AppShortcutText>
                </DropdownMenuItem>
              </template>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
