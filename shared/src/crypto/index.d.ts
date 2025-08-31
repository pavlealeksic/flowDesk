/**
 * Cryptographic utilities for Flow Desk (TypeScript)
 */
/**
 * Generate a secure random ID
 */
export declare function generateId(): string;
/**
 * Generate a hash of the input data using Web Crypto API
 */
export declare function hashData(data: string | Uint8Array): Promise<ArrayBuffer>;
/**
 * Generate a hex-encoded hash string
 */
export declare function hashToHex(data: string | Uint8Array): Promise<string>;
/**
 * Generate a base64-encoded hash string
 */
export declare function hashToBase64(data: string | Uint8Array): Promise<string>;
/**
 * Verify data against a hex-encoded hash
 */
export declare function verifyHexHash(data: string | Uint8Array, expectedHash: string): Promise<boolean>;
/**
 * Encode data as base64
 */
export declare function encodeBase64(data: string | Uint8Array): string;
/**
 * Decode base64 data
 */
export declare function decodeBase64(encoded: string): Uint8Array;
/**
 * Generate a secure random token
 */
export declare function generateToken(length?: number): string;
/**
 * Simple XOR cipher for basic obfuscation (not cryptographically secure)
 */
export declare function xorCipher(data: string, key: string): string;
//# sourceMappingURL=index.d.ts.map