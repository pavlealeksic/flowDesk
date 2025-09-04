"use strict";
/**
 * Proper typed wrapper for electron-store v10
 *
 * This provides a clean interface that wraps electron-store with proper typing
 * to avoid the module resolution issues with the official types.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
exports.createTypedStore = createTypedStore;
const electron_store_1 = __importDefault(require("electron-store"));
exports.Store = electron_store_1.default;
/**
 * Create a typed store instance
 */
function createTypedStore(options) {
    return new electron_store_1.default(options);
}
exports.default = electron_store_1.default;
//# sourceMappingURL=store.js.map