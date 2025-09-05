"use strict";
/**
 * ID Generator Utility
 *
 * Generates unique IDs for various entities in the application
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateIdGenerator = void 0;
exports.generateId = generateId;
exports.generateShortId = generateShortId;
exports.generateUUID = generateUUID;
exports.generateCustomId = generateCustomId;
exports.isValidId = isValidId;
exports.extractPrefix = extractPrefix;
const crypto = __importStar(require("crypto"));
/**
 * Generate a unique ID with optional prefix
 */
function generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(6).toString('hex');
    const id = `${timestamp}${randomBytes}`;
    return prefix ? `${prefix}_${id}` : id;
}
/**
 * Generate a short unique ID (8 characters)
 */
function generateShortId(prefix) {
    const timestamp = Date.now().toString(36).slice(-4);
    const randomBytes = crypto.randomBytes(2).toString('hex');
    const id = `${timestamp}${randomBytes}`;
    return prefix ? `${prefix}_${id}` : id;
}
/**
 * Generate a UUID v4
 */
function generateUUID() {
    return crypto.randomUUID();
}
/**
 * Generate a custom ID with specific format
 */
function generateCustomId(prefix, length = 8, useTimestamp = true) {
    let id = '';
    if (useTimestamp) {
        id += Date.now().toString(36);
    }
    const remainingLength = Math.max(1, length - id.length);
    const randomBytes = crypto.randomBytes(Math.ceil(remainingLength / 2));
    id += randomBytes.toString('hex').substring(0, remainingLength);
    return `${prefix}_${id}`;
}
/**
 * Validate ID format
 */
function isValidId(id) {
    if (!id || typeof id !== 'string') {
        return false;
    }
    // Basic validation - should be alphanumeric with optional underscores
    return /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 3;
}
/**
 * Extract prefix from ID
 */
function extractPrefix(id) {
    const underscoreIndex = id.indexOf('_');
    return underscoreIndex !== -1 ? id.substring(0, underscoreIndex) : null;
}
/**
 * Generate template-specific IDs
 */
exports.TemplateIdGenerator = {
    snippet: () => generateId('snip'),
    emailTemplate: () => generateId('tmpl'),
    category: () => generateId('cat'),
    usage: () => generateId('usage'),
    collection: () => generateId('coll'),
    variable: () => generateId('var')
};
