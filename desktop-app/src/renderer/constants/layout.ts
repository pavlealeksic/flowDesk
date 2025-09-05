/**
 * Layout Constants for FlowDesk Application
 * 
 * These constants define the standard dimensions and spacing used throughout
 * the application to ensure consistency between renderer and main process layouts.
 */

export const LAYOUT_CONSTANTS = {
  // Sidebar dimensions
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
} as const;

// Type for layout constants (for TypeScript type safety)
export type LayoutConstants = typeof LAYOUT_CONSTANTS;