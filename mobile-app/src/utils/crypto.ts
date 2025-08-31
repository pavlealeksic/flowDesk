/**
 * Cryptographic utilities for mobile app
 * 
 * Provides encryption, decryption, and key generation functionality
 * for secure configuration synchronization.
 */

import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Generate a secure random key
 */
export function generateSecureKey(): string {
  // Generate a random key using crypto-js
  const key = CryptoJS.lib.WordArray.random(256 / 8); // 256-bit key
  return CryptoJS.enc.Hex.stringify(key);
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encryptData(data: string, key?: string): Promise<string> {
  try {
    // Use provided key or get/generate device key
    const encryptionKey = key || await getOrCreateDeviceKey();
    
    // Generate a random IV
    const iv = CryptoJS.lib.WordArray.random(96 / 8); // 96-bit IV for GCM
    
    // Encrypt the data
    const encrypted = CryptoJS.AES.encrypt(data, encryptionKey, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.NoPadding
    });
    
    // Combine IV and encrypted data
    const combined = {
      iv: CryptoJS.enc.Hex.stringify(iv),
      encrypted: encrypted.toString(),
    };
    
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(combined)));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decryptData(encryptedData: string, key?: string): Promise<string> {
  try {
    // Use provided key or get device key
    const decryptionKey = key || await getOrCreateDeviceKey();
    
    // Parse the encrypted data
    const combined = JSON.parse(CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(encryptedData)));
    const iv = CryptoJS.enc.Hex.parse(combined.iv);
    
    // Decrypt the data
    const decrypted = CryptoJS.AES.decrypt(combined.encrypted, decryptionKey, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.NoPadding
    });
    
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash data using SHA-256
 */
export function hashData(data: string): string {
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
}

/**
 * Generate HMAC signature
 */
export function generateHMAC(data: string, key: string): string {
  return CryptoJS.HmacSHA256(data, key).toString(CryptoJS.enc.Hex);
}

/**
 * Verify HMAC signature
 */
export function verifyHMAC(data: string, signature: string, key: string): boolean {
  const expectedSignature = generateHMAC(data, key);
  return signature === expectedSignature;
}

/**
 * Get or create device-specific encryption key
 */
async function getOrCreateDeviceKey(): Promise<string> {
  try {
    let deviceKey = await AsyncStorage.getItem('crypto:device-key');
    
    if (!deviceKey) {
      // Generate new device key
      deviceKey = generateSecureKey();
      await AsyncStorage.setItem('crypto:device-key', deviceKey);
    }
    
    return deviceKey;
  } catch (error) {
    console.error('Failed to get/create device key:', error);
    throw new Error('Failed to access device encryption key');
  }
}

/**
 * Secure random number generation
 */
export function secureRandom(min: number, max: number): number {
  const range = max - min + 1;
  const bytes = Math.ceil(Math.log2(range) / 8);
  let random;
  
  do {
    random = 0;
    for (let i = 0; i < bytes; i++) {
      random = random * 256 + Math.floor(Math.random() * 256);
    }
  } while (random >= Math.floor(2 ** (bytes * 8) / range) * range);
  
  return min + (random % range);
}

/**
 * Generate secure random string
 */
export function generateSecureString(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[secureRandom(0, charset.length - 1)];
  }
  return result;
}

/**
 * Key derivation using PBKDF2
 */
export function deriveKey(password: string, salt: string, iterations: number = 10000, keyLength: number = 32): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: keyLength / 4, // CryptoJS uses word arrays (4 bytes per word)
    iterations: iterations,
    hasher: CryptoJS.algo.SHA256
  }).toString(CryptoJS.enc.Hex);
}

/**
 * Generate salt for key derivation
 */
export function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

/**
 * Secure memory cleanup (placeholder)
 * Note: JavaScript doesn't have direct memory management,
 * but this function can be used to clear sensitive variables
 */
export function secureCleanup(sensitiveData: any): void {
  if (typeof sensitiveData === 'string') {
    // Overwrite string with zeros (limited effectiveness in JavaScript)
    for (let i = 0; i < sensitiveData.length; i++) {
      sensitiveData = sensitiveData.substring(0, i) + '0' + sensitiveData.substring(i + 1);
    }
  } else if (typeof sensitiveData === 'object') {
    // Clear object properties
    for (const key in sensitiveData) {
      if (sensitiveData.hasOwnProperty(key)) {
        delete sensitiveData[key];
      }
    }
  }
}