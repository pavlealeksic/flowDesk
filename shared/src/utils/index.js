"use strict";
/**
 * Utility functions for Flow Desk (TypeScript)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEmail = validateEmail;
exports.formatDateDisplay = formatDateDisplay;
exports.parseISODate = parseISODate;
exports.currentTimestamp = currentTimestamp;
exports.daysBetween = daysBetween;
exports.truncateString = truncateString;
exports.extractEmailDomain = extractEmailDomain;
exports.sanitizeString = sanitizeString;
exports.generateSlug = generateSlug;
exports.debounce = debounce;
exports.throttle = throttle;
exports.deepClone = deepClone;
exports.isEmpty = isEmpty;
exports.formatFileSize = formatFileSize;
exports.sleep = sleep;
exports.retry = retry;
/**
 * Validate email address format
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Format a date for display
 */
function formatDateDisplay(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}
/**
 * Parse ISO 8601 date string
 */
function parseISODate(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        throw new Error(`Failed to parse date '${dateStr}'`);
    }
    return date;
}
/**
 * Get current timestamp
 */
function currentTimestamp() {
    return new Date();
}
/**
 * Calculate days between two dates
 */
function daysBetween(start, end) {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
/**
 * Truncate string to specified length with ellipsis
 */
function truncateString(str, maxLength) {
    if (str.length <= maxLength) {
        return str;
    }
    if (maxLength <= 3) {
        return '...';
    }
    return str.substring(0, maxLength - 3) + '...';
}
/**
 * Extract domain from email address
 */
function extractEmailDomain(email) {
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : null;
}
/**
 * Sanitize string for safe display
 */
function sanitizeString(input) {
    return input.replace(/[^\w\s.-_@]/gi, '');
}
/**
 * Generate a slug from a string
 */
function generateSlug(input) {
    return input
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}
/**
 * Debounce function calls
 */
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}
/**
 * Throttle function calls
 */
function throttle(func, delay) {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func(...args);
        }
    };
}
/**
 * Deep clone an object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}
/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
function isEmpty(value) {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return true;
    }
    if (Array.isArray(value) && value.length === 0) {
        return true;
    }
    if (typeof value === 'object' && Object.keys(value).length === 0) {
        return true;
    }
    return false;
}
/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0)
        return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}
/**
 * Sleep/delay function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry function with exponential backoff
 */
async function retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts) {
                break;
            }
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await sleep(delay);
        }
    }
    throw lastError;
}
//# sourceMappingURL=index.js.map