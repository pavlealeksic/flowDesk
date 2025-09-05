"use strict";
/**
 * Layout Constants for FlowDesk Main Process
 *
 * These constants define the standard dimensions used for BrowserView positioning
 * and window layout calculations in the main Electron process.
 *
 * Note: These should match the renderer constants to ensure consistency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAYOUT_CONSTANTS = void 0;
exports.LAYOUT_CONSTANTS = {
    // Primary sidebar (FlowDeskLeftRail)
    PRIMARY_SIDEBAR_WIDTH: 64, // w-16 in Tailwind
    // Services sidebar (ServicesSidebar) 
    SERVICES_SIDEBAR_WIDTH: 256, // w-64 in Tailwind
    // Total sidebar width when both are visible (workspace view)
    TOTAL_SIDEBAR_WIDTH: 320, // 64 + 256
    // Single sidebar width (mail/calendar views)
    SINGLE_SIDEBAR_WIDTH: 64, // Only FlowDeskLeftRail
    // Top bar dimensions
    TOP_BAR_HEIGHT: 0, // No top bar in current design
    // BrowserView positioning (for workspace view)
    BROWSER_VIEW_OFFSET_X: 320, // Total sidebar width
    BROWSER_VIEW_OFFSET_Y: 0, // Same as TOP_BAR_HEIGHT
    // Legacy compatibility
    SIDEBAR_WIDTH: 320, // For backward compatibility
};
