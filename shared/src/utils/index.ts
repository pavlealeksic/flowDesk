/**
 * Utility functions for Flow Desk (TypeScript)
 */

/**
 * Validate email address format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Format a date for display
 */
export function formatDateDisplay(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
}

/**
 * Parse ISO 8601 date string
 */
export function parseISODate(dateStr: string): Date {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error(`Failed to parse date '${dateStr}'`)
  }
  return date
}

/**
 * Get current timestamp
 */
export function currentTimestamp(): Date {
  return new Date()
}

/**
 * Calculate days between two dates
 */
export function daysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  
  if (maxLength <= 3) {
    return '...'
  }
  
  return str.substring(0, maxLength - 3) + '...'
}

/**
 * Extract domain from email address
 */
export function extractEmailDomain(email: string): string | null {
  const match = email.match(/@(.+)$/)
  return match ? match[1].toLowerCase() : null
}

/**
 * Sanitize string for safe display
 */
export function sanitizeString(input: string): string {
  return input.replace(/[^\w\s.-_@]/gi, '')
}

/**
 * Generate a slug from a string
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      func(...args)
    }
  }
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T
  }
  
  const cloned = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  
  return cloned
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) {
    return true
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return true
  }
  
  if (Array.isArray(value) && value.length === 0) {
    return true
  }
  
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return true
  }
  
  return false
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 Bytes'
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === maxAttempts) {
        break
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1)
      await sleep(delay)
    }
  }
  
  throw lastError!
}
