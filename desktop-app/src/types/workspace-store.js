"use strict";
/**
 * Typed ElectronStore wrapper for workspace data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceStore = void 0;
const electron_store_1 = __importDefault(require("electron-store"));
class WorkspaceStore {
    constructor() {
        this.store = new electron_store_1.default({
            name: 'flow-desk-workspaces',
            defaults: {
                workspaces: {},
                settings: {
                    autoSwitchOnActivity: false
                }
            }
        });
    }
    getWorkspaces() {
        return this.store.store.workspaces;
    }
    setWorkspaces(workspaces) {
        this.store.store = { ...this.store.store, workspaces };
    }
    getActiveWorkspaceId() {
        return this.store.store.activeWorkspaceId;
    }
    setActiveWorkspaceId(workspaceId) {
        this.store.store = { ...this.store.store, activeWorkspaceId: workspaceId };
    }
    getSettings() {
        return this.store.store.settings;
    }
    setSettings(settings) {
        this.store.store = { ...this.store.store, settings };
    }
}
exports.WorkspaceStore = WorkspaceStore;
exports.default = WorkspaceStore;
//# sourceMappingURL=workspace-store.js.map