import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Accessibility settings interface
interface AccessibilitySettings {
  highContrast: boolean;
  textScaling: number;
  textScale: number; // Alias for textScaling
  reduceMotion: boolean;
  reducedMotion: boolean; // Alias for reduceMotion
  screenReader: boolean;
  keyboardNavigation: boolean;
  keyboardOnly: boolean;
  focusIndicators: boolean;
  enhancedFocus: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome';
  colorBlindnessMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome' | 'achromatopsia'; // Extended alias
  voiceNavigation: boolean;
  stickyKeys: boolean;
  soundFeedback: boolean;
}

// Accessibility actions
type AccessibilityAction =
  | { type: 'TOGGLE_HIGH_CONTRAST' }
  | { type: 'SET_TEXT_SCALING'; payload: number }
  | { type: 'TOGGLE_REDUCE_MOTION' }
  | { type: 'TOGGLE_SCREEN_READER' }
  | { type: 'TOGGLE_KEYBOARD_NAVIGATION' }
  | { type: 'TOGGLE_KEYBOARD_ONLY' }
  | { type: 'TOGGLE_FOCUS_INDICATORS' }
  | { type: 'TOGGLE_ENHANCED_FOCUS' }
  | { type: 'SET_COLOR_BLIND_MODE'; payload: AccessibilitySettings['colorBlindMode'] }
  | { type: 'SET_COLOR_BLINDNESS_MODE'; payload: AccessibilitySettings['colorBlindnessMode'] }
  | { type: 'TOGGLE_VOICE_NAVIGATION' }
  | { type: 'TOGGLE_STICKY_KEYS' }
  | { type: 'TOGGLE_SOUND_FEEDBACK' }
  | { type: 'RESET_SETTINGS' }
  | { type: 'LOAD_FROM_SYSTEM' };

// Default accessibility settings
const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  textScaling: 1.0,
  textScale: 1.0,
  reduceMotion: false,
  reducedMotion: false,
  screenReader: false,
  keyboardNavigation: true,
  keyboardOnly: false,
  focusIndicators: true,
  enhancedFocus: false,
  colorBlindMode: 'none',
  colorBlindnessMode: 'none',
  voiceNavigation: false,
  stickyKeys: false,
  soundFeedback: false,
};

// Accessibility actions interface
interface AccessibilityActions {
  toggleHighContrast: () => void;
  setTextScale: (scale: number) => void;
  toggleReducedMotion: () => void;
  toggleScreenReader: () => void;
  toggleKeyboardNavigation: () => void;
  toggleFocusIndicators: () => void;
  setColorBlindnessMode: (mode: AccessibilitySettings['colorBlindnessMode']) => void;
  toggleVoiceNavigation: () => void;
  toggleKeyboardOnly: () => void;
  toggleEnhancedFocus: () => void;
  toggleStickyKeys: () => void;
  toggleSoundFeedback: () => void;
  resetToDefaults: () => void;
  loadFromSystem: () => void;
  resetSettings: () => void;
}

// Accessibility context interface
interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: (action: AccessibilityAction) => void;
  actions: AccessibilityActions;
  isAccessibilityModeActive: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

// Accessibility reducer
function accessibilityReducer(state: AccessibilitySettings, action: AccessibilityAction): AccessibilitySettings {
  switch (action.type) {
    case 'TOGGLE_HIGH_CONTRAST':
      return { ...state, highContrast: !state.highContrast };
    case 'SET_TEXT_SCALING': {
      const scaling = Math.max(0.75, Math.min(2.0, action.payload));
      return { ...state, textScaling: scaling, textScale: scaling };
    }
    case 'TOGGLE_REDUCE_MOTION': {
      const newValue = !state.reduceMotion;
      return { ...state, reduceMotion: newValue, reducedMotion: newValue };
    }
    case 'TOGGLE_SCREEN_READER':
      return { ...state, screenReader: !state.screenReader };
    case 'TOGGLE_KEYBOARD_NAVIGATION':
      return { ...state, keyboardNavigation: !state.keyboardNavigation };
    case 'TOGGLE_KEYBOARD_ONLY':
      return { ...state, keyboardOnly: !state.keyboardOnly };
    case 'TOGGLE_FOCUS_INDICATORS':
      return { ...state, focusIndicators: !state.focusIndicators };
    case 'TOGGLE_ENHANCED_FOCUS':
      return { ...state, enhancedFocus: !state.enhancedFocus };
    case 'SET_COLOR_BLIND_MODE':
      return { ...state, colorBlindMode: action.payload };
    case 'SET_COLOR_BLINDNESS_MODE': {
      const mode = action.payload;
      // Map extended modes back to basic modes
      const basicMode = mode === 'achromatopsia' ? 'monochrome' : mode;
      return { 
        ...state, 
        colorBlindnessMode: mode,
        colorBlindMode: basicMode as AccessibilitySettings['colorBlindMode']
      };
    }
    case 'TOGGLE_VOICE_NAVIGATION':
      return { ...state, voiceNavigation: !state.voiceNavigation };
    case 'TOGGLE_STICKY_KEYS':
      return { ...state, stickyKeys: !state.stickyKeys };
    case 'TOGGLE_SOUND_FEEDBACK':
      return { ...state, soundFeedback: !state.soundFeedback };
    case 'RESET_SETTINGS':
      return defaultSettings;
    case 'LOAD_FROM_SYSTEM':
      // Load system accessibility preferences - implementation would depend on platform APIs
      return state; // For now, just return current state
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

  // Create actions object
  const actions: AccessibilityActions = {
    toggleHighContrast: () => dispatch({ type: 'TOGGLE_HIGH_CONTRAST' }),
    setTextScale: (scale: number) => dispatch({ type: 'SET_TEXT_SCALING', payload: scale }),
    toggleReducedMotion: () => dispatch({ type: 'TOGGLE_REDUCE_MOTION' }),
    toggleScreenReader: () => dispatch({ type: 'TOGGLE_SCREEN_READER' }),
    toggleKeyboardNavigation: () => dispatch({ type: 'TOGGLE_KEYBOARD_NAVIGATION' }),
    toggleKeyboardOnly: () => dispatch({ type: 'TOGGLE_KEYBOARD_ONLY' }),
    toggleFocusIndicators: () => dispatch({ type: 'TOGGLE_FOCUS_INDICATORS' }),
    toggleEnhancedFocus: () => dispatch({ type: 'TOGGLE_ENHANCED_FOCUS' }),
    setColorBlindnessMode: (mode: AccessibilitySettings['colorBlindnessMode']) => 
      dispatch({ type: 'SET_COLOR_BLINDNESS_MODE', payload: mode }),
    toggleVoiceNavigation: () => dispatch({ type: 'TOGGLE_VOICE_NAVIGATION' }),
    toggleStickyKeys: () => dispatch({ type: 'TOGGLE_STICKY_KEYS' }),
    toggleSoundFeedback: () => dispatch({ type: 'TOGGLE_SOUND_FEEDBACK' }),
    resetToDefaults: () => dispatch({ type: 'RESET_SETTINGS' }),
    loadFromSystem: () => dispatch({ type: 'LOAD_FROM_SYSTEM' }),
    resetSettings: () => dispatch({ type: 'RESET_SETTINGS' }),
  };

  const contextValue: AccessibilityContextType = {
    settings,
    updateSetting,
    actions,
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

export type { AccessibilitySettings, AccessibilityAction, AccessibilityActions };