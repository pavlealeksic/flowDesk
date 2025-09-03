import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Accessibility settings interface
interface AccessibilitySettings {
  highContrast: boolean;
  textScaling: number;
  reduceMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome';
  voiceNavigation: boolean;
}

// Accessibility actions
type AccessibilityAction =
  | { type: 'TOGGLE_HIGH_CONTRAST' }
  | { type: 'SET_TEXT_SCALING'; payload: number }
  | { type: 'TOGGLE_REDUCE_MOTION' }
  | { type: 'TOGGLE_SCREEN_READER' }
  | { type: 'TOGGLE_KEYBOARD_NAVIGATION' }
  | { type: 'TOGGLE_FOCUS_INDICATORS' }
  | { type: 'SET_COLOR_BLIND_MODE'; payload: AccessibilitySettings['colorBlindMode'] }
  | { type: 'TOGGLE_VOICE_NAVIGATION' }
  | { type: 'RESET_SETTINGS' };

// Default accessibility settings
const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  textScaling: 1.0,
  reduceMotion: false,
  screenReader: false,
  keyboardNavigation: true,
  focusIndicators: true,
  colorBlindMode: 'none',
  voiceNavigation: false,
};

// Accessibility context interface
interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: (action: AccessibilityAction) => void;
  isAccessibilityModeActive: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

// Accessibility reducer
function accessibilityReducer(state: AccessibilitySettings, action: AccessibilityAction): AccessibilitySettings {
  switch (action.type) {
    case 'TOGGLE_HIGH_CONTRAST':
      return { ...state, highContrast: !state.highContrast };
    case 'SET_TEXT_SCALING':
      return { ...state, textScaling: Math.max(0.75, Math.min(2.0, action.payload)) };
    case 'TOGGLE_REDUCE_MOTION':
      return { ...state, reduceMotion: !state.reduceMotion };
    case 'TOGGLE_SCREEN_READER':
      return { ...state, screenReader: !state.screenReader };
    case 'TOGGLE_KEYBOARD_NAVIGATION':
      return { ...state, keyboardNavigation: !state.keyboardNavigation };
    case 'TOGGLE_FOCUS_INDICATORS':
      return { ...state, focusIndicators: !state.focusIndicators };
    case 'SET_COLOR_BLIND_MODE':
      return { ...state, colorBlindMode: action.payload };
    case 'TOGGLE_VOICE_NAVIGATION':
      return { ...state, voiceNavigation: !state.voiceNavigation };
    case 'RESET_SETTINGS':
      return defaultSettings;
    default:
      return state;
  }
}

// Accessibility provider component
interface AccessibilityProviderProps {
  children: ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, dispatch] = useReducer(accessibilityReducer, defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('flow-desk-accessibility');
    if (saved) {
      try {
        const savedSettings = JSON.parse(saved);
        Object.entries(savedSettings).forEach(([key, value]) => {
          if (key in defaultSettings) {
            // Apply each setting individually to ensure type safety
            switch (key as keyof AccessibilitySettings) {
              case 'textScaling':
                dispatch({ type: 'SET_TEXT_SCALING', payload: value as number });
                break;
              case 'colorBlindMode':
                dispatch({ type: 'SET_COLOR_BLIND_MODE', payload: value as AccessibilitySettings['colorBlindMode'] });
                break;
              // Handle boolean toggles
              default:
                if (value !== (defaultSettings as any)[key]) {
                  const actionMap: Record<string, AccessibilityAction['type']> = {
                    highContrast: 'TOGGLE_HIGH_CONTRAST',
                    reduceMotion: 'TOGGLE_REDUCE_MOTION',
                    screenReader: 'TOGGLE_SCREEN_READER',
                    keyboardNavigation: 'TOGGLE_KEYBOARD_NAVIGATION',
                    focusIndicators: 'TOGGLE_FOCUS_INDICATORS',
                    voiceNavigation: 'TOGGLE_VOICE_NAVIGATION',
                  };
                  const actionType = actionMap[key];
                  if (actionType) {
                    dispatch({ type: actionType });
                  }
                }
            }
          }
        });
      } catch (e) {
        console.warn('Failed to load accessibility settings:', e);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('flow-desk-accessibility', JSON.stringify(settings));
  }, [settings]);

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast mode
    root.classList.toggle('accessibility-high-contrast', settings.highContrast);
    
    // Text scaling
    root.style.setProperty('--accessibility-text-scale', settings.textScaling.toString());
    
    // Reduce motion
    root.classList.toggle('accessibility-reduce-motion', settings.reduceMotion);
    
    // Focus indicators
    root.classList.toggle('accessibility-focus-indicators', settings.focusIndicators);
    
    // Color blind mode
    root.classList.remove('accessibility-protanopia', 'accessibility-deuteranopia', 'accessibility-tritanopia', 'accessibility-monochrome');
    if (settings.colorBlindMode !== 'none') {
      root.classList.add(`accessibility-${settings.colorBlindMode}`);
    }
    
    // Screen reader mode
    root.classList.toggle('accessibility-screen-reader', settings.screenReader);
    
  }, [settings]);

  // Detect if any accessibility features are active
  const isAccessibilityModeActive = Object.entries(settings).some(([key, value]) => {
    if (key === 'textScaling') return value !== 1.0;
    if (key === 'colorBlindMode') return value !== 'none';
    return value !== (defaultSettings as any)[key];
  });

  const updateSetting = (action: AccessibilityAction) => {
    dispatch(action);
  };

  const contextValue: AccessibilityContextType = {
    settings,
    updateSetting,
    isAccessibilityModeActive,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
}

// Hook to use accessibility context
export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

// Hook for keyboard navigation
export function useKeyboardNavigation() {
  const { settings } = useAccessibility();
  
  return {
    isEnabled: settings.keyboardNavigation,
    handleKeyDown: (event: React.KeyboardEvent, actions: Record<string, () => void>) => {
      if (!settings.keyboardNavigation) return;
      
      const { key, ctrlKey, altKey, shiftKey } = event;
      const keyCombo = [
        ctrlKey && 'ctrl',
        altKey && 'alt', 
        shiftKey && 'shift',
        key.toLowerCase()
      ].filter(Boolean).join('+');
      
      const action = actions[keyCombo] || actions[key.toLowerCase()];
      if (action) {
        event.preventDefault();
        action();
      }
    }
  };
}

// Hook for screen reader announcements
export function useScreenReaderAnnouncements() {
  const { settings } = useAccessibility();
  
  return {
    announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      if (!settings.screenReader) return;
      
      // Create a live region for announcements
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', priority);
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      
      document.body.appendChild(announcement);
      
      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  };
}

export type { AccessibilitySettings, AccessibilityAction };