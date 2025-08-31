/**
 * Utility functions for Flow Desk (TypeScript)
 */
/**
 * Validate email address format
 */
export declare function validateEmail(email: string): boolean;
/**
 * Format a date for display
 */
export declare function formatDateDisplay(date: Date): string;
/**
 * Parse ISO 8601 date string
 */
export declare function parseISODate(dateStr: string): Date;
/**
 * Get current timestamp
 */
export declare function currentTimestamp(): Date;
/**
 * Calculate days between two dates
 */
export declare function daysBetween(start: Date, end: Date): number;
/**
 * Truncate string to specified length with ellipsis
 */
export declare function truncateString(str: string, maxLength: number): string;
/**
 * Extract domain from email address
 */
export declare function extractEmailDomain(email: string): string | null;
/**
 * Sanitize string for safe display
 */
export declare function sanitizeString(input: string): string;
/**
 * Generate a slug from a string
 */
export declare function generateSlug(input: string): string;
/**
 * Debounce function calls
 */
export declare function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void;
/**
 * Throttle function calls
 */
export declare function throttle<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void;
/**
 * Deep clone an object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export declare function isEmpty(value: any): boolean;
/**
 * Format file size in human readable format
 */
export declare function formatFileSize(bytes: number): string;
/**
 * Sleep/delay function
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, maxAttempts?: number, baseDelay?: number): Promise<T>;
//# sourceMappingURL=index.d.ts.map