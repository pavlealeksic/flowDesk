/**
 * Z-Index Layer Management for Flow Desk
 * 
 * Ensures proper layering hierarchy between BrowserViews, UI elements, and overlays
 */

export const Z_INDEX = {
  // Base layers (lowest priority)
  BASE: 1,
  BROWSER_VIEW: 5,  // BrowserView content should be below all UI
  
  // Main UI layers
  MAIN_CONTENT: 10,
  SIDEBAR: 20,
  NAVIGATION: 30,
  
  // Interactive elements
  DROPDOWN: 100,
  TOOLTIP: 200,
  POPOVER: 300,
  
  // Overlays (medium priority)
  OVERLAY: 500,
  SEARCH_OVERLAY: 600,
  NOTIFICATIONS: 700,
  
  // Modals and high priority overlays (highest priority)
  MODAL_BACKDROP: 1000,
  MODAL: 1100,
  ALERT_MODAL: 1200,
  
  // System level (critical)
  LOADING_OVERLAY: 2000,
  ERROR_BOUNDARY: 2100,
  ACCESSIBILITY_OVERLAY: 2200,
  
  // Maximum (emergency use only)
  MAXIMUM: 9999
} as const

export type ZIndexLayer = keyof typeof Z_INDEX

/**
 * Utility function to get z-index value by layer name
 */
export const getZIndex = (layer: ZIndexLayer): number => {
  return Z_INDEX[layer]
}

/**
 * CSS utility classes for z-index layers
 */
export const zIndexClasses = {
  base: 'z-[1]',
  browserView: 'z-[5]',
  mainContent: 'z-[10]',
  sidebar: 'z-[20]',
  navigation: 'z-[30]',
  dropdown: 'z-[100]',
  tooltip: 'z-[200]',
  popover: 'z-[300]',
  overlay: 'z-[500]',
  searchOverlay: 'z-[600]',
  notifications: 'z-[700]',
  modalBackdrop: 'z-[1000]',
  modal: 'z-[1100]',
  alertModal: 'z-[1200]',
  loadingOverlay: 'z-[2000]',
  errorBoundary: 'z-[2100]',
  accessibilityOverlay: 'z-[2200]',
  maximum: 'z-[9999]'
} as const

/**
 * Get CSS class for z-index layer
 */
export const getZIndexClass = (layer: ZIndexLayer): string => {
  const classMap: Record<ZIndexLayer, string> = {
    BASE: zIndexClasses.base,
    BROWSER_VIEW: zIndexClasses.browserView,
    MAIN_CONTENT: zIndexClasses.mainContent,
    SIDEBAR: zIndexClasses.sidebar,
    NAVIGATION: zIndexClasses.navigation,
    DROPDOWN: zIndexClasses.dropdown,
    TOOLTIP: zIndexClasses.tooltip,
    POPOVER: zIndexClasses.popover,
    OVERLAY: zIndexClasses.overlay,
    SEARCH_OVERLAY: zIndexClasses.searchOverlay,
    NOTIFICATIONS: zIndexClasses.notifications,
    MODAL_BACKDROP: zIndexClasses.modalBackdrop,
    MODAL: zIndexClasses.modal,
    ALERT_MODAL: zIndexClasses.alertModal,
    LOADING_OVERLAY: zIndexClasses.loadingOverlay,
    ERROR_BOUNDARY: zIndexClasses.errorBoundary,
    ACCESSIBILITY_OVERLAY: zIndexClasses.accessibilityOverlay,
    MAXIMUM: zIndexClasses.maximum
  }
  
  return classMap[layer]
}

/**
 * Check if a layer should hide WebContentsViews
 */
export const shouldHideWebContentsViews = (layer: ZIndexLayer): boolean => {
  const hidingLayers: ZIndexLayer[] = [
    'MODAL_BACKDROP',
    'MODAL',
    'ALERT_MODAL',
    'LOADING_OVERLAY',
    'ERROR_BOUNDARY',
    'ACCESSIBILITY_OVERLAY',
    'SEARCH_OVERLAY'
  ]
  
  return hidingLayers.includes(layer)
}

/**
 * Legacy compatibility function for BrowserView references
 * @deprecated Use shouldHideWebContentsViews instead
 */
export const shouldHideBrowserViews = shouldHideWebContentsViews