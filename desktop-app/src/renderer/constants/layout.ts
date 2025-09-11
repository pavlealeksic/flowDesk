/**
 * Layout Constants for FlowDesk Application
 * 
 * These constants define the standard dimensions and spacing used throughout
 * the application to ensure consistency between renderer and main process layouts.
 * 
 * The values can be overridden by the configuration system when available.
 */

// Default layout values (fallback when config is not available)
const DEFAULT_LAYOUT = {
  PRIMARY_SIDEBAR_WIDTH: 64,
  SERVICES_SIDEBAR_WIDTH: 256,
  TOTAL_SIDEBAR_WIDTH: 320, // Calculated: PRIMARY_SIDEBAR_WIDTH + SERVICES_SIDEBAR_WIDTH
  SIDEBAR_WIDTH: 280,
  DOCKED_PANEL_WIDTH: 280,
  MIN_PANEL_WIDTH: 200,
  MAX_PANEL_WIDTH: 500,
  TOP_BAR_HEIGHT: 0,
  CONTENT_PADDING: 16,
  PANEL_PADDING: 12,
  WEB_CONTENTS_VIEW_OFFSET_X: 320, // Total sidebar width
  WEB_CONTENTS_VIEW_OFFSET_Y: 0,   // Same as TOP_BAR_HEIGHT
  BROWSER_VIEW_OFFSET_X: 320, // Total sidebar width
  BROWSER_VIEW_OFFSET_Y: 0,   // Same as TOP_BAR_HEIGHT
} as const;

// Current layout configuration (can be updated by config)
let layoutConfig = { ...DEFAULT_LAYOUT };

/**
 * Update layout configuration from AppConfig
 * This function should be called when configuration is loaded
 */
export function updateLayoutConfig(newConfig: Partial<typeof DEFAULT_LAYOUT>): void {
  layoutConfig = { ...layoutConfig, ...newConfig };
}

/**
 * Get current layout constants
 * Returns configuration values when available, otherwise falls back to defaults
 */
export const LAYOUT_CONSTANTS = new Proxy(layoutConfig, {
  get(target, prop: keyof typeof DEFAULT_LAYOUT) {
    return target[prop] ?? DEFAULT_LAYOUT[prop];
  }
}) as typeof DEFAULT_LAYOUT;

// Utility functions for common layout calculations
export const LayoutUtils = {
  /**
   * Get total sidebar width (primary + services)
   */
  getTotalSidebarWidth(): number {
    return LAYOUT_CONSTANTS.PRIMARY_SIDEBAR_WIDTH + LAYOUT_CONSTANTS.SERVICES_SIDEBAR_WIDTH;
  },

  /**
   * Get web view positioning considering sidebar visibility
   */
  getWebViewPosition(includeSidebars: boolean = true): { x: number; y: number } {
    return {
      x: includeSidebars ? this.getTotalSidebarWidth() : 0,
      y: LAYOUT_CONSTANTS.TOP_BAR_HEIGHT
    };
  },

  /**
   * Check if a panel can be resized to a given width
   */
  canResizePanel(width: number): boolean {
    return width >= LAYOUT_CONSTANTS.MIN_PANEL_WIDTH && 
           width <= LAYOUT_CONSTANTS.MAX_PANEL_WIDTH;
  },

  /**
   * Clamp panel width to valid range
   */
  clampPanelWidth(width: number): number {
    return Math.max(LAYOUT_CONSTANTS.MIN_PANEL_WIDTH, 
                   Math.min(LAYOUT_CONSTANTS.MAX_PANEL_WIDTH, width));
  }
} as const;

// Type for layout constants (for TypeScript type safety)
export type LayoutConstants = typeof LAYOUT_CONSTANTS;