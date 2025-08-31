/**
 * Add Mail Account Modal - Mobile-optimized OAuth flow
 * 
 * Provides a clean interface for adding mail accounts using OAuth2
 * with proper error handling and user feedback.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../store';
import { authService } from '../../services/authService';
import { mailService } from '../../services/mailService';
import type { MailProvider } from '@flow-desk/shared';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface ProviderOption {
  id: MailProvider;
  name: string;
  description: string;
  icon: string;
  color: string;
  logo?: any; // Would be require() for local images
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Google Workspace and personal Gmail accounts',
    icon: 'logo-google',
    color: '#DB4437',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Microsoft 365 and Outlook.com accounts',
    icon: 'logo-microsoft',
    color: '#0078D4',
  },
  {
    id: 'imap',
    name: 'Other Email',
    description: 'IMAP/SMTP compatible email providers',
    icon: 'mail',
    color: '#666666',
  },
];

export function AddAccountModal({ visible, onClose }: Props) {
  const theme = useStore(state => state.theme);
  const addAccount = useStore(state => state.addAccount);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<MailProvider | null>(null);

  const handleAddAccount = useCallback(async (provider: MailProvider) => {
    setIsConnecting(true);
    setConnectingProvider(provider);

    try {
      if (provider === 'imap') {
        // For IMAP, show manual configuration screen
        Alert.alert(
          'Manual Configuration',
          'IMAP/SMTP configuration is not yet implemented in this version.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Authenticate with OAuth2
      const authResult = await authService.authenticateAccount(provider);
      
      if (!authResult.userInfo?.email) {
        throw new Error('Could not retrieve email address from account');
      }

      // Create account data
      const accountData = {
        userId: 'current-user', // TODO: Get from auth context
        name: authResult.userInfo.name || authResult.userInfo.email,
        email: authResult.userInfo.email,
        provider,
        config: {
          provider,
          clientId: provider === 'gmail' 
            ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || ''
            : process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '',
          scopes: authResult.scope.split(' '),
          enablePushNotifications: true,
          ...(provider === 'gmail' && { 
            enablePushNotifications: true,
            historyId: undefined,
          }),
          ...(provider === 'outlook' && { 
            tenantId: undefined,
            enableWebhooks: true,
            deltaToken: undefined,
          }),
        },
        credentials: {
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          tokenExpiresAt: new Date(Date.now() + (authResult.expiresIn * 1000)),
        },
        status: 'active' as const,
        syncIntervalMinutes: 5,
        isEnabled: true,
      };

      // Add account to mail service
      const account = await mailService.addAccount(accountData);
      
      // Store credentials securely
      await authService.storeCredentials(account.id, provider, authResult);

      // Add to local store
      addAccount(account);

      Alert.alert(
        'Account Added',
        `Successfully added ${authResult.userInfo.name || authResult.userInfo.email}`,
        [{ text: 'OK' }]
      );

      onClose();
    } catch (error) {
      console.error('Error adding account:', error);
      
      let errorMessage = 'Failed to add account';
      if (error instanceof Error) {
        if (error.message.includes('cancelled')) {
          errorMessage = 'Authentication was cancelled';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsConnecting(false);
      setConnectingProvider(null);
    }
  }, [addAccount, onClose]);

  const ProviderCard = ({ provider }: { provider: ProviderOption }) => {
    const isConnecting = connectingProvider === provider.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.providerCard,
          { borderColor: theme.colors.outline },
          isConnecting && { opacity: 0.6 },
        ]}
        onPress={() => handleAddAccount(provider.id)}
        disabled={isConnecting}
        activeOpacity={0.7}
      >
        <View style={styles.providerIcon}>
          <Ionicons
            name={provider.icon as any}
            size={32}
            color={provider.color}
          />
        </View>
        
        <View style={styles.providerInfo}>
          <Text style={[styles.providerName, { color: theme.colors.onSurface }]}>
            {provider.name}
          </Text>
          <Text style={[styles.providerDescription, { color: theme.colors.onSurfaceVariant }]}>
            {provider.description}
          </Text>
        </View>

        <View style={styles.providerAction}>
          {isConnecting ? (
            <ActivityIndicator size="small" color={provider.color} />
          ) : (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    headerTitle: {
      fontSize: theme.typography.sizes.xl,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.onSurface,
    },
    closeButton: {
      padding: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surfaceVariant,
    },
    content: {
      padding: theme.spacing.lg,
    },
    description: {
      fontSize: theme.typography.sizes.base,
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.xl,
      textAlign: 'center',
      lineHeight: 22,
    },
    providersList: {
      gap: theme.spacing.md,
    },
    providerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      backgroundColor: theme.colors.surface,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    providerIcon: {
      width: 56,
      height: 56,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surfaceVariant,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.md,
    },
    providerInfo: {
      flex: 1,
    },
    providerName: {
      fontSize: theme.typography.sizes.lg,
      fontWeight: theme.typography.weights.semibold,
      marginBottom: theme.spacing.xs,
    },
    providerDescription: {
      fontSize: theme.typography.sizes.sm,
      lineHeight: 18,
    },
    providerAction: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      padding: theme.spacing.xl,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: theme.spacing.md,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    securityNote: {
      marginTop: theme.spacing.xl,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: theme.borderRadius.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    securityIcon: {
      marginRight: theme.spacing.sm,
      marginTop: 2,
    },
    securityText: {
      flex: 1,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.onPrimaryContainer,
      lineHeight: 18,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Email Account</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isConnecting}
            >
              <Ionicons name="close" size={20} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Choose your email provider to connect your account securely using OAuth2 authentication.
            </Text>

            {isConnecting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>
                  Connecting to {PROVIDER_OPTIONS.find(p => p.id === connectingProvider)?.name}...
                  {'\n'}Please complete authentication in your browser.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.providersList}>
                  {PROVIDER_OPTIONS.map((provider) => (
                    <ProviderCard key={provider.id} provider={provider} />
                  ))}
                </View>

                <View style={styles.securityNote}>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={theme.colors.onPrimaryContainer}
                    style={styles.securityIcon}
                  />
                  <Text style={styles.securityText}>
                    Your credentials are encrypted and stored securely on your device. 
                    We use industry-standard OAuth2 authentication and never store your passwords.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}