/**
 * Theme Store Slice - Manages app theming and appearance
 */

import { StateCreator } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  surfaceVariant: string;
  
  // Text colors
  onBackground: string;
  onSurface: string;
  onSurfaceVariant: string;
  
  // Primary colors
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  
  // Secondary colors
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  
  // Error colors
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  
  // Outline colors
  outline: string;
  outlineVariant: string;
  
  // Special colors
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  typography: {
    sizes: {
      xs: number;
      sm: number;
      base: number;
      lg: number;
      xl: number;
      xxl: number;
      xxxl: number;
    };
    weights: {
      light: '300';
      normal: '400';
      medium: '500';
      semibold: '600';
      bold: '700';
    };
  };
  borderRadius: {
    none: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
}

const lightTheme: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FEFBFF',
  surfaceVariant: '#E7E0EC',
  onBackground: '#1C1B1F',
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#D0BCFF',
};

const darkTheme: ThemeColors = {
  background: '#1C1B1F',
  surface: '#1C1B1F',
  surfaceVariant: '#49454F',
  onBackground: '#E6E1E5',
  onSurface: '#E6E1E5',
  onSurfaceVariant: '#CAC4D0',
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  outline: '#938F99',
  outlineVariant: '#49454F',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#E6E1E5',
  inverseOnSurface: '#313033',
  inversePrimary: '#6750A4',
};

const createTheme = (mode: ThemeMode, systemColorScheme: ColorSchemeName): Theme => {
  const isDark = mode === 'dark' || (mode === 'auto' && systemColorScheme === 'dark');
  
  return {
    mode,
    colors: isDark ? darkTheme : lightTheme,
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },
    typography: {
      sizes: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        xxxl: 32,
      },
      weights: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
    borderRadius: {
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
  };
};

export interface ThemeSlice {
  theme: Theme;
  themeMode: ThemeMode;
  systemColorScheme: ColorSchemeName;
  
  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setSystemColorScheme: (scheme: ColorSchemeName) => void;
  initializeTheme: () => void;
  toggleTheme: () => void;
}

export const createThemeStore: StateCreator<
  any,
  [],
  [],
  ThemeSlice
> = (set, get) => {
  const systemColorScheme = Appearance.getColorScheme();
  const initialMode: ThemeMode = 'auto';
  
  return {
    theme: createTheme(initialMode, systemColorScheme),
    themeMode: initialMode,
    systemColorScheme,
    
    setThemeMode: (mode: ThemeMode) => {
      set((state: any) => {
        state.themeMode = mode;
        state.theme = createTheme(mode, state.systemColorScheme);
      });
    },
    
    setSystemColorScheme: (scheme: ColorSchemeName) => {
      set((state: any) => {
        state.systemColorScheme = scheme;
        state.theme = createTheme(state.themeMode, scheme);
      });
    },
    
    initializeTheme: () => {
      // Listen for system theme changes
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        get().setSystemColorScheme(colorScheme);
      });
      
      // Store subscription for cleanup (in a real app, you'd want to clean this up)
      return () => subscription.remove();
    },
    
    toggleTheme: () => {
      const currentMode = get().themeMode;
      const newMode: ThemeMode = currentMode === 'light' ? 'dark' : 
                                 currentMode === 'dark' ? 'auto' : 'light';
      get().setThemeMode(newMode);
    },
  };
};