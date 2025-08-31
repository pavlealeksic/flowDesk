/**
 * Button Component - Reusable button with consistent theming
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../store';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: any;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
}: ButtonProps) {
  const theme = useStore(state => state.theme);
  
  const isDisabled = disabled || loading;
  
  const styles = StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      ...(fullWidth && { alignSelf: 'stretch' }),
      ...(size === 'sm' && {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        minHeight: 32,
      }),
      ...(size === 'md' && {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        minHeight: 40,
      }),
      ...(size === 'lg' && {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        minHeight: 48,
      }),
      ...(variant === 'primary' && {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
      }),
      ...(variant === 'secondary' && {
        backgroundColor: theme.colors.secondary,
        borderColor: theme.colors.secondary,
      }),
      ...(variant === 'outline' && {
        backgroundColor: 'transparent',
        borderColor: theme.colors.outline,
      }),
      ...(variant === 'ghost' && {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      }),
      ...(isDisabled && {
        opacity: 0.5,
      }),
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    text: {
      fontWeight: theme.typography.weights.medium,
      ...(size === 'sm' && {
        fontSize: theme.typography.sizes.sm,
      }),
      ...(size === 'md' && {
        fontSize: theme.typography.sizes.base,
      }),
      ...(size === 'lg' && {
        fontSize: theme.typography.sizes.lg,
      }),
      ...(variant === 'primary' && {
        color: theme.colors.onPrimary,
      }),
      ...(variant === 'secondary' && {
        color: theme.colors.onSecondary,
      }),
      ...(variant === 'outline' && {
        color: theme.colors.onSurface,
      }),
      ...(variant === 'ghost' && {
        color: theme.colors.onSurface,
      }),
    },
  });
  
  const iconSize = size === 'sm' ? 16 : size === 'md' ? 18 : 20;
  const iconColor = variant === 'primary' 
    ? theme.colors.onPrimary 
    : variant === 'secondary' 
    ? theme.colors.onSecondary 
    : theme.colors.onSurface;
  
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={iconColor}
          />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <Ionicons name={icon} size={iconSize} color={iconColor} />
            )}
            <Text style={styles.text}>{title}</Text>
            {icon && iconPosition === 'right' && (
              <Ionicons name={icon} size={iconSize} color={iconColor} />
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}