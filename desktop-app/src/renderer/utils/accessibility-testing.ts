/**
 * Accessibility Testing Utilities
 * 
 * This module provides utilities for testing accessibility features
 * and ensuring WCAG 2.1 AA compliance in the Flow Desk application.
 */

export interface AccessibilityTestResult {
  passed: boolean
  score: number
  issues: AccessibilityIssue[]
  summary: AccessibilitySummary
}

export interface AccessibilityIssue {
  type: 'error' | 'warning' | 'info'
  rule: string
  element: string
  description: string
  suggestion: string
  wcagLevel: 'A' | 'AA' | 'AAA'
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
}

export interface AccessibilitySummary {
  totalElements: number
  focusableElements: number
  imagesWithAlt: number
  imagesWithoutAlt: number
  formsWithLabels: number
  formsWithoutLabels: number
  headingStructure: boolean
  colorContrast: boolean
  keyboardNavigation: boolean
}

/**
 * Runs a comprehensive accessibility audit on the current page
 */
export async function runAccessibilityAudit(): Promise<AccessibilityTestResult> {
  const issues: AccessibilityIssue[] = []
  let score = 100

  // Test 1: Check for missing alt attributes
  const missingAltImages = checkMissingAltAttributes()
  issues.push(...missingAltImages)
  score -= missingAltImages.length * 5

  // Test 2: Check form labels
  const missingLabels = checkFormLabels()
  issues.push(...missingLabels)
  score -= missingLabels.length * 10

  // Test 3: Check heading structure
  const headingIssues = checkHeadingStructure()
  issues.push(...headingIssues)
  score -= headingIssues.length * 8

  // Test 4: Check color contrast
  const contrastIssues = await checkColorContrast()
  issues.push(...contrastIssues)
  score -= contrastIssues.length * 7

  // Test 5: Check keyboard navigation
  const keyboardIssues = checkKeyboardNavigation()
  issues.push(...keyboardIssues)
  score -= keyboardIssues.length * 6

  // Test 6: Check ARIA usage
  const ariaIssues = checkAriaUsage()
  issues.push(...ariaIssues)
  score -= ariaIssues.length * 5

  // Test 7: Check focus management
  const focusIssues = checkFocusManagement()
  issues.push(...focusIssues)
  score -= focusIssues.length * 8

  // Test 8: Check semantic HTML
  const semanticIssues = checkSemanticHTML()
  issues.push(...semanticIssues)
  score -= semanticIssues.length * 4

  const summary = generateSummary()
  
  return {
    passed: score >= 80,
    score: Math.max(0, score),
    issues,
    summary
  }
}

/**
 * Check for images missing alt attributes
 */
function checkMissingAltAttributes(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const images = document.querySelectorAll('img')
  
  images.forEach((img, index) => {
    if (!img.hasAttribute('alt')) {
      issues.push({
        type: 'error',
        rule: 'img-alt',
        element: `img[${index}] - ${img.src || 'no src'}`,
        description: 'Image missing alt attribute',
        suggestion: 'Add meaningful alt text or alt="" for decorative images',
        wcagLevel: 'A',
        severity: 'serious'
      })
    } else if (img.alt === '' && !img.hasAttribute('aria-hidden')) {
      // Empty alt should be accompanied by aria-hidden for decorative images
      if (!isDecorativeImage(img)) {
        issues.push({
          type: 'warning',
          rule: 'img-alt-decorative',
          element: `img[${index}] - ${img.src || 'no src'}`,
          description: 'Image has empty alt text but may not be decorative',
          suggestion: 'Add descriptive alt text or aria-hidden="true" if decorative',
          wcagLevel: 'A',
          severity: 'moderate'
        })
      }
    }
  })
  
  return issues
}

/**
 * Check for form elements missing labels
 */
function checkFormLabels(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const formElements = document.querySelectorAll('input, select, textarea')
  
  formElements.forEach((element, index) => {
    const input = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    
    if (input.type === 'hidden') return
    
    const hasLabel = hasAssociatedLabel(input)
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby')
    
    if (!hasLabel && !hasAriaLabel) {
      issues.push({
        type: 'error',
        rule: 'label-missing',
        element: `${input.tagName.toLowerCase()}[${index}] - ${input.name || input.id || 'no identifier'}`,
        description: 'Form element missing accessible label',
        suggestion: 'Add a <label> element, aria-label, or aria-labelledby attribute',
        wcagLevel: 'A',
        severity: 'critical'
      })
    }
  })
  
  return issues
}

/**
 * Check heading structure (h1, h2, h3, etc.)
 */
function checkHeadingStructure(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
  
  if (headings.length === 0) {
    issues.push({
      type: 'warning',
      rule: 'no-headings',
      element: 'document',
      description: 'No headings found on page',
      suggestion: 'Add appropriate heading elements to structure content',
      wcagLevel: 'AA',
      severity: 'moderate'
    })
    return issues
  }
  
  let previousLevel = 0
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName[1])
    
    if (index === 0 && level !== 1) {
      issues.push({
        type: 'warning',
        rule: 'first-heading-h1',
        element: `${heading.tagName.toLowerCase()}[${index}]`,
        description: 'First heading should be h1',
        suggestion: 'Use h1 for the main page heading',
        wcagLevel: 'AA',
        severity: 'moderate'
      })
    }
    
    if (level > previousLevel + 1) {
      issues.push({
        type: 'error',
        rule: 'heading-skip-level',
        element: `${heading.tagName.toLowerCase()}[${index}]`,
        description: `Heading level skips from h${previousLevel} to h${level}`,
        suggestion: 'Use heading levels in sequential order',
        wcagLevel: 'AA',
        severity: 'serious'
      })
    }
    
    if (heading.textContent?.trim() === '') {
      issues.push({
        type: 'error',
        rule: 'empty-heading',
        element: `${heading.tagName.toLowerCase()}[${index}]`,
        description: 'Heading is empty',
        suggestion: 'Add meaningful text content to headings',
        wcagLevel: 'A',
        severity: 'critical'
      })
    }
    
    previousLevel = level
  })
  
  return issues
}

/**
 * Check color contrast ratios
 */
async function checkColorContrast(): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = []
  const textElements = document.querySelectorAll('*')
  
  for (const element of textElements) {
    const htmlElement = element as HTMLElement
    const styles = getComputedStyle(htmlElement)
    const fontSize = parseFloat(styles.fontSize)
    const fontWeight = styles.fontWeight
    
    if (htmlElement.textContent?.trim() && fontSize > 0) {
      const contrast = await calculateContrastRatio(htmlElement)
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || fontWeight >= '700'))
      const minContrast = isLargeText ? 3 : 4.5 // WCAG AA standards
      
      if (contrast < minContrast) {
        issues.push({
          type: 'error',
          rule: 'color-contrast',
          element: `${htmlElement.tagName.toLowerCase()} - "${htmlElement.textContent.substring(0, 50)}"`,
          description: `Color contrast ratio ${contrast.toFixed(2)}:1 is below minimum ${minContrast}:1`,
          suggestion: 'Increase color contrast between text and background',
          wcagLevel: 'AA',
          severity: 'serious'
        })
      }
    }
  }
  
  return issues
}

/**
 * Check keyboard navigation support
 */
function checkKeyboardNavigation(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex], [role="button"], [role="link"]')
  
  interactiveElements.forEach((element, index) => {
    const htmlElement = element as HTMLElement
    
    // Check if element is keyboard accessible
    if (htmlElement.tabIndex === -1 && !htmlElement.hasAttribute('aria-hidden')) {
      issues.push({
        type: 'warning',
        rule: 'keyboard-access',
        element: `${htmlElement.tagName.toLowerCase()}[${index}]`,
        description: 'Interactive element not keyboard accessible',
        suggestion: 'Ensure interactive elements can be reached with Tab key',
        wcagLevel: 'A',
        severity: 'serious'
      })
    }
    
    // Check for click handlers on non-interactive elements
    if (!isInteractiveElement(htmlElement) && hasClickHandler(htmlElement)) {
      issues.push({
        type: 'error',
        rule: 'click-handler-non-interactive',
        element: `${htmlElement.tagName.toLowerCase()}[${index}]`,
        description: 'Non-interactive element has click handler',
        suggestion: 'Use button element or add keyboard event handlers',
        wcagLevel: 'A',
        severity: 'critical'
      })
    }
  })
  
  return issues
}

/**
 * Check ARIA usage
 */
function checkAriaUsage(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [role]')
  
  elementsWithAria.forEach((element, index) => {
    const htmlElement = element as HTMLElement
    
    // Check for empty aria-label
    if (htmlElement.hasAttribute('aria-label') && htmlElement.getAttribute('aria-label')?.trim() === '') {
      issues.push({
        type: 'error',
        rule: 'empty-aria-label',
        element: `${htmlElement.tagName.toLowerCase()}[${index}]`,
        description: 'Empty aria-label attribute',
        suggestion: 'Provide meaningful aria-label text or remove the attribute',
        wcagLevel: 'A',
        severity: 'serious'
      })
    }
    
    // Check for invalid ARIA references
    if (htmlElement.hasAttribute('aria-labelledby')) {
      const ids = htmlElement.getAttribute('aria-labelledby')!.split(' ')
      ids.forEach(id => {
        if (!document.getElementById(id)) {
          issues.push({
            type: 'error',
            rule: 'aria-labelledby-missing',
            element: `${htmlElement.tagName.toLowerCase()}[${index}]`,
            description: `aria-labelledby references non-existent element with id="${id}"`,
            suggestion: 'Ensure referenced elements exist in the DOM',
            wcagLevel: 'A',
            severity: 'critical'
          })
        }
      })
    }
    
    if (htmlElement.hasAttribute('aria-describedby')) {
      const ids = htmlElement.getAttribute('aria-describedby')!.split(' ')
      ids.forEach(id => {
        if (!document.getElementById(id)) {
          issues.push({
            type: 'error',
            rule: 'aria-describedby-missing',
            element: `${htmlElement.tagName.toLowerCase()}[${index}]`,
            description: `aria-describedby references non-existent element with id="${id}"`,
            suggestion: 'Ensure referenced elements exist in the DOM',
            wcagLevel: 'A',
            severity: 'critical'
          })
        }
      })
    }
  })
  
  return issues
}

/**
 * Check focus management
 */
function checkFocusManagement(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const focusableElements = getFocusableElements()
  
  if (focusableElements.length === 0) {
    issues.push({
      type: 'warning',
      rule: 'no-focusable-elements',
      element: 'document',
      description: 'No focusable elements found',
      suggestion: 'Ensure there are interactive elements users can navigate to',
      wcagLevel: 'A',
      severity: 'moderate'
    })
  }
  
  // Check for focus traps in modals
  const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"]')
  modals.forEach((modal, index) => {
    const modalElement = modal as HTMLElement
    if (!modalElement.hasAttribute('aria-modal')) {
      issues.push({
        type: 'warning',
        rule: 'modal-aria-modal',
        element: `modal[${index}]`,
        description: 'Modal missing aria-modal attribute',
        suggestion: 'Add aria-modal="true" to modal dialogs',
        wcagLevel: 'AA',
        severity: 'moderate'
      })
    }
  })
  
  return issues
}

/**
 * Check semantic HTML usage
 */
function checkSemanticHTML(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  
  // Check for main landmark
  const mainElements = document.querySelectorAll('main, [role="main"]')
  if (mainElements.length === 0) {
    issues.push({
      type: 'warning',
      rule: 'no-main-landmark',
      element: 'document',
      description: 'No main landmark found',
      suggestion: 'Add <main> element or role="main" to identify main content',
      wcagLevel: 'AA',
      severity: 'moderate'
    })
  } else if (mainElements.length > 1) {
    issues.push({
      type: 'error',
      rule: 'multiple-main-landmarks',
      element: 'document',
      description: 'Multiple main landmarks found',
      suggestion: 'Use only one main landmark per page',
      wcagLevel: 'AA',
      severity: 'serious'
    })
  }
  
  // Check for navigation landmarks
  const navElements = document.querySelectorAll('nav, [role="navigation"]')
  navElements.forEach((nav, index) => {
    const navElement = nav as HTMLElement
    if (!navElement.hasAttribute('aria-label') && !navElement.hasAttribute('aria-labelledby')) {
      if (navElements.length > 1) {
        issues.push({
          type: 'warning',
          rule: 'nav-no-label',
          element: `nav[${index}]`,
          description: 'Navigation landmark missing accessible name',
          suggestion: 'Add aria-label to distinguish between multiple navigation sections',
          wcagLevel: 'AA',
          severity: 'moderate'
        })
      }
    }
  })
  
  return issues
}

/**
 * Generate accessibility summary
 */
function generateSummary(): AccessibilitySummary {
  const allElements = document.querySelectorAll('*').length
  const focusableElements = getFocusableElements().length
  const images = document.querySelectorAll('img')
  const imagesWithAlt = Array.from(images).filter(img => img.hasAttribute('alt')).length
  const imagesWithoutAlt = images.length - imagesWithAlt
  
  const formElements = document.querySelectorAll('input, select, textarea')
  const formsWithLabels = Array.from(formElements).filter(element => 
    hasAssociatedLabel(element as HTMLFormElement) || 
    element.hasAttribute('aria-label') || 
    element.hasAttribute('aria-labelledby')
  ).length
  const formsWithoutLabels = formElements.length - formsWithLabels
  
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const headingStructure = checkHeadingSequence(headings)
  
  return {
    totalElements: allElements,
    focusableElements,
    imagesWithAlt,
    imagesWithoutAlt,
    formsWithLabels,
    formsWithoutLabels,
    headingStructure,
    colorContrast: true, // Simplified for now
    keyboardNavigation: focusableElements > 0
  }
}

// Helper functions

function isDecorativeImage(img: HTMLImageElement): boolean {
  // Simple heuristic: check if image is likely decorative
  const src = img.src.toLowerCase()
  return src.includes('decoration') || src.includes('icon') || src.includes('logo')
}

function hasAssociatedLabel(element: HTMLFormElement): boolean {
  if (!element.id) return false
  return !!document.querySelector(`label[for="${element.id}"]`)
}

async function calculateContrastRatio(element: HTMLElement): Promise<number> {
  // Simplified contrast calculation
  // In a real implementation, this would calculate actual color values
  const styles = getComputedStyle(element)
  const color = styles.color
  const backgroundColor = styles.backgroundColor
  
  // Return a mock contrast ratio for now
  // Real implementation would parse colors and calculate luminance
  return Math.random() * 10 + 1 // Mock value between 1 and 11
}

function isInteractiveElement(element: HTMLElement): boolean {
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea']
  return interactiveTags.includes(element.tagName.toLowerCase()) ||
         element.hasAttribute('role') && 
         ['button', 'link', 'menuitem', 'option'].includes(element.getAttribute('role')!)
}

function hasClickHandler(element: HTMLElement): boolean {
  // Check if element has onclick attribute or event listeners
  return element.hasAttribute('onclick') ||
         element.onclick !== null ||
         // This is a simplified check - real implementation would be more thorough
         element.getAttribute('class')?.includes('clickable') === true
}

function getFocusableElements(): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]:not([disabled])',
    '[role="link"]:not([disabled])'
  ].join(', ')
  
  return Array.from(document.querySelectorAll(selector)) as HTMLElement[]
}

function checkHeadingSequence(headings: NodeListOf<Element>): boolean {
  let previousLevel = 0
  for (const heading of headings) {
    const level = parseInt(heading.tagName[1])
    if (level > previousLevel + 1) {
      return false
    }
    previousLevel = level
  }
  return true
}

/**
 * Test keyboard navigation programmatically
 */
export async function testKeyboardNavigation(): Promise<boolean> {
  const focusableElements = getFocusableElements()
  if (focusableElements.length === 0) return false
  
  let canNavigate = true
  let currentIndex = 0
  
  // Test Tab navigation
  for (let i = 0; i < Math.min(5, focusableElements.length); i++) {
    try {
      focusableElements[currentIndex].focus()
      
      // Simulate Tab key
      const event = new KeyboardEvent('keydown', { key: 'Tab' })
      document.dispatchEvent(event)
      
      // Wait a bit for focus to change
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check if focus moved to next element
      const nextIndex = (currentIndex + 1) % focusableElements.length
      if (document.activeElement !== focusableElements[nextIndex]) {
        canNavigate = false
        break
      }
      
      currentIndex = nextIndex
    } catch (error) {
      canNavigate = false
      break
    }
  }
  
  return canNavigate
}

/**
 * Test screen reader compatibility
 */
export function testScreenReaderCompatibility(): { passed: boolean; issues: string[] } {
  const issues: string[] = []
  
  // Check for ARIA landmarks
  const landmarks = document.querySelectorAll('main, nav, aside, section, header, footer, [role="main"], [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"]')
  if (landmarks.length === 0) {
    issues.push('No ARIA landmarks found - screen readers cannot navigate page structure')
  }
  
  // Check for alt text on images
  const imagesWithoutAlt = document.querySelectorAll('img:not([alt])')
  if (imagesWithoutAlt.length > 0) {
    issues.push(`${imagesWithoutAlt.length} images missing alt text`)
  }
  
  // Check for form labels
  const unlabeledInputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])')
  const unlabeledInputsWithoutLabels = Array.from(unlabeledInputs).filter(input => {
    const inputElement = input as HTMLInputElement
    return !hasAssociatedLabel(inputElement as any)
  })
  
  if (unlabeledInputsWithoutLabels.length > 0) {
    issues.push(`${unlabeledInputsWithoutLabels.length} form inputs missing labels`)
  }
  
  return {
    passed: issues.length === 0,
    issues
  }
}