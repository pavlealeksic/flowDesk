"use strict";
/**
 * Cryptographic utilities for Flow Desk (TypeScript)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.hashData = hashData;
exports.hashToHex = hashToHex;
exports.hashToBase64 = hashToBase64;
exports.verifyHexHash = verifyHexHash;
exports.encodeBase64 = encodeBase64;
exports.decodeBase64 = decodeBase64;
exports.generateToken = generateToken;
exports.xorCipher = xorCipher;
/**
 * Generate a secure random ID
 */
function generateId() {
    // Using crypto.randomUUID if available, fallback to manual generation
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
/**
 * Generate a hash of the input data using Web Crypto API
 */
async function hashData(data) {
    const encoder = new TextEncoder();
    const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        return await crypto.subtle.digest('SHA-256', dataBuffer);
    }
    throw new Error('Web Crypto API not available');
}
/**
 * Generate a hex-encoded hash string
 */
async function hashToHex(data) {
    const hashBuffer = await hashData(data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
/**
 * Generate a base64-encoded hash string
 */
async function hashToBase64(data) {
    const hashBuffer = await hashData(data);
    const hashArray = new Uint8Array(hashBuffer);
    return btoa(String.fromCharCode.apply(null, Array.from(hashArray)));
}
/**
 * Verify data against a hex-encoded hash
 */
async function verifyHexHash(data, expectedHash) {
    try {
        const computedHash = await hashToHex(data);
        return computedHash === expectedHash;
    }
    catch {
        return false;
    }
}
/**
 * Encode data as base64
 */
function encodeBase64(data) {
    if (typeof data === 'string') {
        return btoa(data);
    }
    const binaryString = String.fromCharCode.apply(null, Array.from(data));
    return btoa(binaryString);
}
/**
 * Decode base64 data
 */
function decodeBase64(encoded) {
    try {
        const binaryString = atob(encoded);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    catch (error) {
        throw new Error(`Base64 decode error: ${error}`);
    }
}
/**
 * Generate a secure random token
 */
function generateToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
    }
    else {
        // Fallback for environments without crypto
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
    }
    return result;
}
/**
 * Simple XOR cipher for basic obfuscation (not cryptographically secure)
 */
function xorCipher(data, key) {
    let result = '';
    for (let i = 0; i < data.length; i++) {
        const keyChar = key[i % key.length];
        const dataChar = data[i];
        result += String.fromCharCode(dataChar.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }
    return result;
}
//# sourceMappingURL=index.js.map