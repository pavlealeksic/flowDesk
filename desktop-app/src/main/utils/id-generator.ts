/**
 * ID Generator Utility
 * 
 * Generates unique IDs for various entities in the application
 */

import * as crypto from 'crypto';

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(6).toString('hex');
  const id = `${timestamp}${randomBytes}`;
  
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate a short unique ID (8 characters)
 */
export function generateShortId(prefix?: string): string {
  const timestamp = Date.now().toString(36).slice(-4);
  const randomBytes = crypto.randomBytes(2).toString('hex');
  const id = `${timestamp}${randomBytes}`;
  
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a custom ID with specific format
 */
export function generateCustomId(
  prefix: string,
  length: number = 8,
  useTimestamp: boolean = true
): string {
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
export function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // Basic validation - should be alphanumeric with optional underscores
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length >= 3;
}

/**
 * Extract prefix from ID
 */
export function extractPrefix(id: string): string | null {
  const underscoreIndex = id.indexOf('_');
  return underscoreIndex !== -1 ? id.substring(0, underscoreIndex) : null;
}

/**
 * Generate template-specific IDs
 */
export const TemplateIdGenerator = {
  snippet: () => generateId('snip'),
  emailTemplate: () => generateId('tmpl'),
  category: () => generateId('cat'),
  usage: () => generateId('usage'),
  collection: () => generateId('coll'),
  variable: () => generateId('var')
};