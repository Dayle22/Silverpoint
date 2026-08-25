export {
  clampPanelsToOverlay,
  clampRectToOverlay,
  closeGroup,
  closeRegisteredPanel,
  containerGroups,
  defaultPanelLayout,
  dockGroup,
  dockPanel,
  dockedPanelIds,
  floatContainer,
  floatContainerIds,
  floatGroup,
  floatPanel,
  groupOf,
  isPanelFloating,
  moveGroup,
  movePanel,
  normalisePanelLayout,
  openRegisteredPanel,
  panelCollapsed,
  panelContainerId,
  panelLayout,
  panelSizing,
  raiseFloat,
  raisePanelContainer,
  resetPanelLayout,
  setActiveTab,
  setFloatRect,
  setGroupCollapsed,
  setGroupHeight,
  setMemberHeight,
  setPanelCollapsed,
  writePanelLayout,
  toggleGroupCollapsed,
  togglePanelCollapsed,
  togglePanelOpen
} from '@/app/shell/panels/layout'

export {
  allContainerIds,
  closeGroup as closeGroupPure,
  closePanel,
  containerGroups as containerGroupsPure,
  containerMembers,
  containerOf,
  detachPanel,
  dockGroup as dockGroupPure,
  dockPanel as dockPanelPure,
  floatContainerById,
  floatGroup as floatGroupPure,
  locatePanel,
  moveGroup as moveGroupPure,
  movePanel as movePanelPure,
  normalisePanelLayout as normalisePanelLayoutPure,
  openPanel,
  raiseFloat as raiseFloatPure,
  resetPanelLayout as resetPanelLayoutPure,
  setActiveTab as setActiveTabPure,
  setDockWidth,
  setFloatRect as setFloatRectPure,
  setGroupCollapsed as setGroupCollapsedPure,
  setGroupHeight as setGroupHeightPure,
  setMemberHeight as setMemberHeightPure,
  setPanelCollapsed as setPanelCollapsedPure,
  togglePanelOpen as togglePanelOpenPure
} from '@/app/shell/panels/operations'

export { migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5 } from '@/app/shell/panels/containers'

export { PANEL_REGISTRY, PANEL_REGISTRY_BY_ID, type PanelRegistryEntry } from '@/app/shell/panels/registry'

export {
  effectiveDockWidths,
  measurePanelOverlay,
  panelHost,
  panelOverlayEl,
  panelOverlaySize,
  resetPanelHosts,
  setPanelHost,
  toOverlayRect
} from '@/app/shell/panels/hosts'

export {
  draggingContainer,
  nudgePanel,
  panelDraggingGroupContainer,
  panelDraggingId,
  panelInsertionTarget,
  panelSnapGuides,
  clearPanelInsertionTarget,
  setPanelInsertionTarget,
  startContainerDrag,
  startGroupDrag,
  startPanelDrag
} from '@/app/shell/panels/drag'

export { RESIZE_CURSORS, startPanelResize, type ResizeHandle } from '@/app/shell/panels/resize'

export { snapPanelRect, PANEL_SNAP_THRESHOLD, type SnapGuide, type SnapResult } from '@/app/shell/panels/snap'

export {
  resolveDropIndex,
  resolveDropTarget,
  PANEL_EDGE_DOCK_WIDTH,
  type ContainerGeometry,
  type DropTarget,
  type GroupGeometry
} from '@/app/shell/panels/drop-target'

export {
  isFloatId,
  isPanelId,
  PANEL_COLLAPSED_HEIGHT,
  PANEL_FLOAT_TITLE_HEIGHT,
  PANEL_IDS,
  PANEL_LAYOUT_VERSION,
  PANEL_LAYOUT_VERSION_V4,
  PANEL_MAX_WIDTH,
  PANEL_MEMBER_MAX_HEIGHT,
  PANEL_MEMBER_MIN_HEIGHT,
  PANEL_MIN_VISIBLE,
  PANEL_MIN_WIDTH,
  PANEL_CANVAS_MIN_WIDTH,
  PANEL_DOCK_MIN_WIDTH,
  PANEL_SEAM_ZONE,
  type ContainerId,
  type DockSide,
  type FloatContainer,
  type FloatId,
  type PanelGroup,
  type PanelId,
  type LegacyPanelId,
  type PanelLayout,
  type PanelLayoutV4,
  type PanelRect,
  type PanelSizing,
  type RegisteredPanelState
} from '@/app/shell/panels/types'
