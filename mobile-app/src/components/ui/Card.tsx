/**
 * Card Component - Reusable card container with consistent theming
 */

import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useStore } from '../../store';

export interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function Card({
  variant = 'default',
  padding = 'md',
  children,
  style,
  ...props
}: CardProps) {
  const theme = useStore(state => state.theme);
  
  const styles = StyleSheet.create({
    card: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      ...(variant === 'elevated' && {
        shadowColor: theme.colors.shadow,
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      }),
      ...(variant === 'outlined' && {
        borderWidth: 1,
        borderColor: theme.colors.outline,
      }),
      ...(padding === 'sm' && {
        padding: theme.spacing.sm,
      }),
      ...(padding === 'md' && {
        padding: theme.spacing.md,
      }),
      ...(padding === 'lg' && {
        padding: theme.spacing.lg,
      }),
    },
  });
  
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}