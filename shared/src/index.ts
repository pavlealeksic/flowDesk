/**
 * Flow Desk Shared Library
 * 
 * Shared services, types, and utilities for Flow Desk applications
 */

// Re-export everything from sub-modules
export * from './types'
export * from './crypto'
export * from './utils'

// Version information
export const VERSION = '0.1.0'

// Library initialization
export function init() {
  // Initialization logic if needed
  console.log(`Flow Desk Shared Library v${VERSION} initialized`)
}
