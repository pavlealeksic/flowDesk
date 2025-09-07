import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function focusRing(options: { offset?: boolean } = {}) {
  return [
    // base
    'outline outline-0 focus-visible:outline-2 focus-visible:outline-offset-2',
    // outline color
    'focus-visible:outline-primary',
    // offset
    options.offset && 'focus-visible:outline-offset-2'
  ]
}

export function getTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function getAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#0ea5e9'
}

// Keyboard shortcuts utilities
export function formatKeyboardShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return shortcut
    .replace(/\bCmd\b/g, isMac ? '⌘' : 'Ctrl')
    .replace(/\bAlt\b/g, isMac ? '⌥' : 'Alt')
    .replace(/\bShift\b/g, isMac ? '⇧' : 'Shift')
    .replace(/\bTab\b/g, '⇥')
    .replace(/\bEnter\b/g, '↩')
    .replace(/\bEsc\b/g, '⎋')
    .replace(/\bArrowUp\b/g, '↑')
    .replace(/\bArrowDown\b/g, '↓')
    .replace(/\bArrowLeft\b/g, '←')
    .replace(/\bArrowRight\b/g, '→')
}

// Animation utilities
export function getReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
         document.documentElement.classList.contains('reduced-motion')
}

export const animationDuration = {
  fast: getReducedMotion() ? '0ms' : '150ms',
  base: getReducedMotion() ? '0ms' : '200ms',
  slow: getReducedMotion() ? '0ms' : '300ms'
}

// Size and spacing utilities
export const spacing = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.25rem',  // 20px
  xl: '1.5rem',   // 24px
  '2xl': '2rem',  // 32px
  '3xl': '2.5rem' // 40px
}

export const borderRadius = {
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem'    // 16px
}

// Color utilities for dynamic theming
export function getThemeColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    background: style.getPropertyValue('--background'),
    foreground: style.getPropertyValue('--foreground'),
    primary: style.getPropertyValue('--primary'),
    secondary: style.getPropertyValue('--secondary'),
    accent: style.getPropertyValue('--accent'),
    muted: style.getPropertyValue('--muted'),
    border: style.getPropertyValue('--border'),
    card: style.getPropertyValue('--card'),
    popover: style.getPropertyValue('--popover')
  }
}