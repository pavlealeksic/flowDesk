/**
 * Layout Constants for FlowDesk Main Process
 * 
 * These constants define the standard dimensions used for BrowserView positioning
 * and window layout calculations in the main Electron process.
 * 
 * Note: These should match the renderer constants to ensure consistency.
 */

export const LAYOUT_CONSTANTS = {
  // Sidebar dimensions - must match renderer sidebar width
  SIDEBAR_WIDTH: 280,
  
  // Top bar dimensions
  TOP_BAR_HEIGHT: 0, // No top bar in current design
  
  // BrowserView positioning
  BROWSER_VIEW_OFFSET_X: 280, // Same as SIDEBAR_WIDTH
  BROWSER_VIEW_OFFSET_Y: 0,   // Same as TOP_BAR_HEIGHT
} as const;

// Type for layout constants (for TypeScript type safety)
export type LayoutConstants = typeof LAYOUT_CONSTANTS;