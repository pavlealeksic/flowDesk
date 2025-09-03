# Flow Desk Accessibility Guide

This guide documents the comprehensive accessibility features implemented in Flow Desk to ensure WCAG 2.1 AA compliance and inclusive design.

## Overview

Flow Desk includes extensive accessibility features to support users with diverse abilities and needs, including:

- Screen reader compatibility
- Keyboard-only navigation
- Voice navigation support
- High contrast mode
- Text scaling
- Color blindness support
- Reduced motion preferences
- Enhanced focus indicators

## Accessibility Features

### 1. Screen Reader Support

#### ARIA Implementation
- **Semantic HTML**: All components use proper semantic HTML elements
- **ARIA Labels**: Comprehensive `aria-label`, `aria-labelledby`, and `aria-describedby` attributes
- **Landmark Roles**: Proper `role` attributes for navigation, main content, and complementary areas
- **Live Regions**: `aria-live` regions for dynamic content updates

#### Screen Reader Announcements
- Status changes are announced (loading states, errors, success messages)
- Navigation changes are communicated
- Form validation feedback is announced
- Modal open/close events are announced

#### Usage
```tsx
import { useScreenReader } from './hooks/useAccessibility'

const { announce } = useScreenReader()
announce('Operation completed successfully', 'polite')
```

### 2. Keyboard Navigation

#### Focus Management
- **Focus Trapping**: Modals and overlays trap focus within their boundaries
- **Focus Restoration**: Focus returns to trigger element when modals close
- **Skip Links**: Skip navigation links for screen reader users
- **Tab Order**: Logical tab order throughout the application

#### Keyboard Shortcuts
- `Ctrl/Cmd + K`: Open search
- `Ctrl/Cmd + 1/2/3`: Switch between Mail/Calendar/Workspace views
- `Ctrl/Cmd + ,`: Open accessibility settings
- `Ctrl/Cmd + Alt + H`: Toggle high contrast
- `Ctrl/Cmd + Alt + R`: Toggle reduced motion
- `Ctrl/Cmd + Alt + V`: Toggle voice navigation
- `Ctrl/Cmd + Alt + +/-`: Adjust text size
- `Escape`: Close modals and overlays

#### Implementation
```tsx
import { useFocusTrap, useKeyboardNavigation } from './hooks/useAccessibility'

const { containerRef } = useFocusTrap(isModalOpen)
const { activeIndex, containerRef: navRef } = useKeyboardNavigation(itemCount, 'vertical')
```

### 3. Voice Navigation

#### Voice Commands
- "open mail" - Switch to mail view
- "open calendar" - Switch to calendar view
- "open search" - Open search interface
- "next" - Navigate to next focusable element
- "previous" - Navigate to previous focusable element
- "activate" - Activate the focused element
- "close" - Close current modal or overlay

#### Usage
```tsx
import { useVoiceNavigation } from './hooks/useAccessibility'

const { isVoiceNavigationEnabled, toggleVoiceNavigation, isListening } = useVoiceNavigation()
```

### 4. Visual Accessibility

#### High Contrast Mode
- Automatic detection of system preferences
- Manual toggle available
- Enhanced border visibility
- Increased color differences
- Removed gradients and shadows

#### Color Blindness Support
- Protanopia (red-blind) filter
- Deuteranopia (green-blind) filter
- Tritanopia (blue-blind) filter
- Achromatopsia (complete color blindness) filter
- Alternative color schemes

#### Text Scaling
- Support for 75% to 200% scaling
- Maintains layout integrity
- Scales all text elements proportionally
- Respects user's browser zoom settings

```tsx
import { useTextScaling, useColorAccessibility } from './hooks/useAccessibility'

const { textScale, increaseTextSize, decreaseTextSize } = useTextScaling()
const { colorBlindnessMode, setColorBlindnessMode } = useColorAccessibility()
```

### 5. Motion and Animation

#### Reduced Motion Support
- Respects `prefers-reduced-motion` media query
- Disables animations and transitions when enabled
- Maintains functionality without motion
- Toggle available in accessibility settings

```tsx
import { useReducedMotion } from './hooks/useAccessibility'

const { prefersReducedMotion, getAnimationClass } = useReducedMotion()
const animationClass = getAnimationClass('animate-slide-in', 'no-animation')
```

### 6. Enhanced Focus Indicators

#### Focus Styles
- High-visibility focus outlines
- Consistent focus styling across components
- Proper focus-visible implementation
- Enhanced focus for keyboard-only mode

```tsx
import { useEnhancedFocus } from './hooks/useAccessibility'

const { getFocusClasses } = useEnhancedFocus()
const focusClasses = getFocusClasses('button')
```

## Component Accessibility

### Button Component

```tsx
<Button
  aria-label="Save document"
  aria-pressed={isSaved}
  aria-describedby="save-description"
  description="This will save your current work"
  shortcut={{ key: 's', modifiers: ['cmd'] }}
  loading={isSaving}
  loadingText="Saving document..."
>
  Save
</Button>
```

### Input Component

```tsx
<Input
  label="Email Address"
  description="Enter your work email address"
  required
  type="email"
  error={emailError}
  validationState="error"
  aria-describedby="email-help"
  showPasswordToggle={false}
/>
```

### Modal Component

```tsx
<Modal
  isOpen={isModalOpen}
  onClose={closeModal}
  title="Confirm Action"
  description="This action cannot be undone"
  variant="danger"
  role="alertdialog"
  closeOnEscape={true}
  announceOnOpen={true}
>
  <ConfirmModal
    onConfirm={handleConfirm}
    confirmText="Delete"
    confirmVariant="destructive"
  />
</Modal>
```

## Accessibility Context

### AccessibilityProvider

The `AccessibilityProvider` manages all accessibility settings and preferences:

```tsx
import { AccessibilityProvider, useAccessibility } from './contexts/AccessibilityContext'

function App() {
  return (
    <AccessibilityProvider>
      <YourApp />
    </AccessibilityProvider>
  )
}

function YourComponent() {
  const { settings, actions } = useAccessibility()
  
  return (
    <div>
      <button onClick={actions.toggleHighContrast}>
        High Contrast: {settings.highContrast ? 'On' : 'Off'}
      </button>
    </div>
  )
}
```

## Testing Accessibility

### Automated Testing

```tsx
import { runAccessibilityAudit, testKeyboardNavigation } from './utils/accessibility-testing'

// Run comprehensive accessibility audit
const auditResults = await runAccessibilityAudit()
console.log(`Accessibility score: ${auditResults.score}/100`)
console.log(`Issues found: ${auditResults.issues.length}`)

// Test keyboard navigation
const keyboardAccessible = await testKeyboardNavigation()
console.log(`Keyboard navigation: ${keyboardAccessible ? 'Pass' : 'Fail'}`)
```

### Manual Testing Checklist

#### Keyboard Navigation
- [ ] All interactive elements are reachable with Tab
- [ ] Tab order is logical and intuitive
- [ ] Shift+Tab navigates backward correctly
- [ ] Enter/Space activate buttons and links
- [ ] Escape closes modals and dropdowns
- [ ] Arrow keys navigate within components (lists, menus)

#### Screen Reader Testing
- [ ] All images have appropriate alt text
- [ ] Form inputs have associated labels
- [ ] Headings create logical document structure
- [ ] Landmarks identify page regions
- [ ] Status changes are announced
- [ ] Error messages are announced

#### Visual Testing
- [ ] Focus indicators are clearly visible
- [ ] Color is not the only way information is conveyed
- [ ] Text has sufficient contrast (4.5:1 minimum)
- [ ] Content is readable at 200% zoom
- [ ] High contrast mode works properly

#### Motor Impairment Testing
- [ ] Click targets are at least 44x44 pixels
- [ ] No content depends on hover
- [ ] Drag and drop has keyboard alternatives
- [ ] Time limits can be extended or disabled

## Browser Support

### Screen Reader Compatibility
- **NVDA** (Windows) - Full support
- **JAWS** (Windows) - Full support
- **VoiceOver** (macOS) - Full support
- **TalkBack** (Android) - Basic support
- **Voice Control** (iOS/macOS) - Voice navigation support

### Browser Compatibility
- **Chrome/Edge** (Chromium) - Full support
- **Firefox** - Full support
- **Safari** - Full support
- **Mobile browsers** - Basic support

## Implementation Notes

### CSS Custom Properties
```css
:root {
  --text-scale: 1;
}

* {
  font-size: calc(1em * var(--text-scale));
}
```

### Focus Management
```tsx
// Focus trap implementation
const { containerRef, firstFocusableElementRef, lastFocusableElementRef } = useFocusTrap(isActive)
```

### ARIA Live Regions
```tsx
// Screen reader announcements
const announcement = document.createElement('div')
announcement.setAttribute('aria-live', 'polite')
announcement.setAttribute('aria-atomic', 'true')
announcement.className = 'sr-only'
announcement.textContent = message
document.body.appendChild(announcement)
```

## Best Practices

### Development Guidelines

1. **Semantic HTML First**
   - Use appropriate HTML elements before adding ARIA
   - Prefer `<button>` over `<div role="button">`
   - Use headings for structure, not styling

2. **ARIA Usage**
   - Only use ARIA when necessary
   - Ensure ARIA attributes reference existing elements
   - Test with actual screen readers

3. **Keyboard Navigation**
   - Implement logical tab order
   - Provide keyboard alternatives for mouse interactions
   - Handle focus management in dynamic content

4. **Visual Design**
   - Maintain 4.5:1 contrast ratio for normal text
   - Maintain 3:1 contrast ratio for large text
   - Don't rely on color alone to convey information

5. **Testing**
   - Test with keyboard only
   - Test with screen readers
   - Test with high contrast mode
   - Test with 200% browser zoom

### Code Examples

#### Accessible Form
```tsx
<form role="form" aria-labelledby="form-title">
  <h2 id="form-title">Contact Information</h2>
  
  <Input
    id="name"
    label="Full Name"
    required
    aria-describedby="name-help"
    error={nameError}
  />
  <div id="name-help" className="sr-only">
    Enter your first and last name
  </div>
  
  <Button type="submit" aria-describedby="submit-help">
    Submit Form
  </Button>
  <div id="submit-help" className="sr-only">
    This will send your information to our team
  </div>
</form>
```

#### Accessible Navigation
```tsx
<nav role="navigation" aria-label="Main navigation">
  <ul role="list">
    <li role="listitem">
      <Button
        role="tab"
        aria-selected={activeView === 'mail'}
        aria-controls="main-content"
        onClick={() => setActiveView('mail')}
      >
        Mail
      </Button>
    </li>
  </ul>
</nav>
```

## Resources

### WCAG 2.1 Guidelines
- [WCAG 2.1 AA Standards](https://www.w3.org/WAI/WCAG21/quickref/?currentsidebar=%23col_overview&levels=aaa)
- [Web Content Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/)

### Testing Tools
- [axe-core](https://github.com/dequelabs/axe-core) - Automated accessibility testing
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Accessibility audit

### Screen Readers for Testing
- [NVDA](https://www.nvaccess.org/) - Free Windows screen reader
- [VoiceOver](https://www.apple.com/accessibility/mac/vision/) - Built-in macOS screen reader
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) - Professional Windows screen reader

## Support

For accessibility issues or questions, please:

1. Check this guide for implementation examples
2. Run the built-in accessibility audit tool
3. Test with actual assistive technologies
4. Contact the development team with specific use cases

Remember: Accessibility is not a feature to be added later—it should be considered from the beginning of the design and development process.