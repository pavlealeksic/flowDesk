/**
 * Z-Index Layer Management for Flow Desk
 * 
 * Ensures proper layering hierarchy between BrowserViews, UI elements, and overlays
 * 
 * Values are sourced from AppConfig configuration system with fallback defaults.
 */

// Fallback defaults (should match config defaults)
const DEFAULT_Z_INDEX = {
  BASE: 1,
  BROWSER_VIEW: 5,
  MAIN_CONTENT: 10,
  SIDEBAR: 20,
  NAVIGATION: 30,
  DROPDOWN: 100,
  TOOLTIP: 200,
  POPOVER: 300,
  OVERLAY: 500,
  SEARCH_OVERLAY: 600,
  NOTIFICATIONS: 700,
  MODAL_BACKDROP: 1000,
  MODAL: 1100,
  ALERT_MODAL: 1200,
  LOADING_OVERLAY: 2000,
  ERROR_BOUNDARY: 2100,
  ACCESSIBILITY_OVERLAY: 2200,
  MAXIMUM: 9999
} as const

export const Z_INDEX = {
  // Base layers (lowest priority)
  BASE: DEFAULT_Z_INDEX.BASE,
  BROWSER_VIEW: DEFAULT_Z_INDEX.BROWSER_VIEW,
  
  // Main UI layers
  MAIN_CONTENT: DEFAULT_Z_INDEX.MAIN_CONTENT,
  SIDEBAR: DEFAULT_Z_INDEX.SIDEBAR,
  NAVIGATION: DEFAULT_Z_INDEX.NAVIGATION,
  
  // Interactive elements
  DROPDOWN: DEFAULT_Z_INDEX.DROPDOWN,
  TOOLTIP: DEFAULT_Z_INDEX.TOOLTIP,
  POPOVER: DEFAULT_Z_INDEX.POPOVER,
  
  // Overlays (medium priority)
  OVERLAY: DEFAULT_Z_INDEX.OVERLAY,
  SEARCH_OVERLAY: DEFAULT_Z_INDEX.SEARCH_OVERLAY,
  NOTIFICATIONS: DEFAULT_Z_INDEX.NOTIFICATIONS,
  
  // Modals and high priority overlays (highest priority)
  MODAL_BACKDROP: DEFAULT_Z_INDEX.MODAL_BACKDROP,
  MODAL: DEFAULT_Z_INDEX.MODAL,
  ALERT_MODAL: DEFAULT_Z_INDEX.ALERT_MODAL,
  
  // System level (critical)
  LOADING_OVERLAY: DEFAULT_Z_INDEX.LOADING_OVERLAY,
  ERROR_BOUNDARY: DEFAULT_Z_INDEX.ERROR_BOUNDARY,
  ACCESSIBILITY_OVERLAY: DEFAULT_Z_INDEX.ACCESSIBILITY_OVERLAY,
  
  // Maximum (emergency use only)
  MAXIMUM: DEFAULT_Z_INDEX.MAXIMUM
} as const

export type ZIndexLayer = keyof typeof Z_INDEX

/**
 * Utility function to get z-index value by layer name
 */
export const getZIndex = (layer: ZIndexLayer): number => {
  return Z_INDEX[layer]
}

/**
 * Update Z_INDEX values from configuration
 * This function can be called when configuration is loaded
 */
export const updateZIndexFromConfig = (configZIndex: any) => {
  // This would update Z_INDEX values from config when IPC is available
  // For now, we use the fallback defaults
  console.debug('Z-index configuration update - using fallback defaults')
}

/**
 * Get z-index with potential config override (for future use)
 */
export const getDynamicZIndex = (layer: ZIndexLayer, config?: any): number => {
  // Future implementation: check config for overrides
  // For now, return the default value
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