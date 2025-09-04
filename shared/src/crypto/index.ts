/**
 * Cryptographic utilities for Flow Desk (TypeScript)
 */

/**
 * Generate a secure random ID
 */
export function generateId(): string {
  // Using crypto.randomUUID if available, fallback to manual generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Generate a hash of the input data using Web Crypto API
 */
export async function hashData(data: string | Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const dataBuffer: BufferSource = typeof data === 'string' 
    ? encoder.encode(data) 
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return await crypto.subtle.digest('SHA-256', dataBuffer)
  }
  
  throw new Error('Web Crypto API not available')
}

/**
 * Generate a hex-encoded hash string
 */
export async function hashToHex(data: string | Uint8Array): Promise<string> {
  const hashBuffer = await hashData(data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a base64-encoded hash string
 */
export async function hashToBase64(data: string | Uint8Array): Promise<string> {
  const hashBuffer = await hashData(data)
  const hashArray = new Uint8Array(hashBuffer)
  return btoa(String.fromCharCode.apply(null, Array.from(hashArray)))
}

/**
 * Verify data against a hex-encoded hash
 */
export async function verifyHexHash(data: string | Uint8Array, expectedHash: string): Promise<boolean> {
  try {
    const computedHash = await hashToHex(data)
    return computedHash === expectedHash
  } catch {
    return false
  }
}

/**
 * Encode data as base64
 */
export function encodeBase64(data: string | Uint8Array): string {
  if (typeof data === 'string') {
    return btoa(data)
  }
  
  const binaryString = String.fromCharCode.apply(null, Array.from(data))
  return btoa(binaryString)
}

/**
 * Decode base64 data
 */
export function decodeBase64(encoded: string): Uint8Array {
  try {
    const binaryString = atob(encoded)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  } catch (error) {
    throw new Error(`Base64 decode error: ${error}`)
  }
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length]
    }
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  
  return result
}

/**
 * Simple XOR cipher for basic obfuscation (not cryptographically secure)
 */
export function xorCipher(data: string, key: string): string {
  let result = ''
  for (let i = 0; i < data.length; i++) {
    const keyChar = key[i % key.length]
    const dataChar = data[i]
    result += String.fromCharCode(dataChar.charCodeAt(0) ^ keyChar.charCodeAt(0))
  }
  return result
}
