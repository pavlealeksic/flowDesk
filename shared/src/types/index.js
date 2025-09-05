"use strict";
/**
 * Flow Desk Shared Types
 *
 * Comprehensive type definitions for the Flow Desk application ecosystem.
 * This package provides type-safe interfaces for all core domain areas.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Export all type modules with explicit re-exports to avoid conflicts
__exportStar(require("./user"), exports);
__exportStar(require("./mail"), exports);
__exportStar(require("./calendar"), exports);
__exportStar(require("./plugin"), exports);
__exportStar(require("./billing"), exports);
__exportStar(require("./errors"), exports);
__exportStar(require("./api"), exports);
// Automation types removed to simplify the app
// Legacy types have been removed to prevent duplicate exports
// Import types directly from their respective modules:
// - User types from './user'
// - Mail types from './mail'  
// - Calendar types from './calendar'
// - Plugin types from './plugin'
// - Config types from './config'
// - API types from './api'
//# sourceMappingURL=index.js.map