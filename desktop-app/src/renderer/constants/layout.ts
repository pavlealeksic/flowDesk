/**
 * Layout Constants for FlowDesk Application
 * 
 * These constants define the standard dimensions and spacing used throughout
 * the application to ensure consistency between renderer and main process layouts.
 */

export const LAYOUT_CONSTANTS = {
  // Primary sidebar (FlowDeskLeftRail)
  PRIMARY_SIDEBAR_WIDTH: 64, // w-16 in Tailwind
  
  // Services sidebar (ServicesSidebar) 
  SERVICES_SIDEBAR_WIDTH: 256, // w-64 in Tailwind
  
  // Total sidebar width when both are visible (workspace view)
  TOTAL_SIDEBAR_WIDTH: 320, // 64 + 256
  
  // Legacy sidebar width for backwards compatibility
  SIDEBAR_WIDTH: 280,
  
  // Panel dimensions  
  DOCKED_PANEL_WIDTH: 280,
  
  // Minimum dimensions for resizable panels
  MIN_PANEL_WIDTH: 200,
  MAX_PANEL_WIDTH: 500,
  
  // Top bar and navigation
  TOP_BAR_HEIGHT: 0, // No top bar in current design
  
  // Spacing and margins
  CONTENT_PADDING: 16,
  PANEL_PADDING: 12,
  
  // WebContentsView positioning (for workspace view)
  WEB_CONTENTS_VIEW_OFFSET_X: 320, // Total sidebar width
  WEB_CONTENTS_VIEW_OFFSET_Y: 0,   // Same as TOP_BAR_HEIGHT
  
  // Legacy compatibility
  BROWSER_VIEW_OFFSET_X: 320, // Total sidebar width
  BROWSER_VIEW_OFFSET_Y: 0,   // Same as TOP_BAR_HEIGHT
} as const;

// Type for layout constants (for TypeScript type safety)
export type LayoutConstants = typeof LAYOUT_CONSTANTS;