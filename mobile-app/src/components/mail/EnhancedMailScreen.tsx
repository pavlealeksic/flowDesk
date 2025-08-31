/**
 * Enhanced Mail Screen - Mobile-optimized with touch interactions
 * 
 * Features swipe actions, pull-to-refresh, long press menus,
 * and optimized touch interactions for mobile use.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  ActionSheetIOS,
  Platform,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../store';
import { MailMessage, MailAccount } from '../../store/slices/mailSlice';
import { AddAccountModal } from './AddAccountModal';
import { ComposeModal } from './ComposeModal';

const { width: screenWidth } = Dimensions.get('window');
const SWIPE_THRESHOLD = screenWidth * 0.25;

interface SwipeAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  backgroundColor: string;
  action: (messageId: string) => void;
}

export default function EnhancedMailScreen() {
  const theme = useStore(state => state.theme);
  const accounts = useStore(state => state.accounts);
  const messages = useStore(state => state.messages);
  const activeAccountId = useStore(state => state.activeAccountId);
  const selectedFolderId = useStore(state => state.selectedFolderId);
  const selectedMessageId = useStore(state => state.selectedMessageId);
  const isLoading = useStore(state => state.isLoading);
  const isSyncing = useStore(state => state.isSyncing);
  
  const syncAllAccounts = useStore(state => state.syncAllAccounts);
  const setActiveAccount = useStore(state => state.setActiveAccount);
  const setSelectedMessage = useStore(state => state.setSelectedMessage);
  const markAsRead = useStore(state => state.markAsRead);
  const starMessage = useStore(state => state.starMessage);
  const deleteMessage = useStore(state => state.deleteMessage);
  const archiveMessage = useStore(state => state.archiveMessage);
  const moveMessage = useStore(state => state.moveMessage);
  
  const [selectedView, setSelectedView] = useState<'list' | 'message'>('list');
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [longPressedMessage, setLongPressedMessage] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => {
    // Auto-sync on mount
    if (accounts.length > 0) {
      syncAllAccounts();
    }
  }, [accounts.length]);

  const activeAccount = accounts.find(acc => acc.id === activeAccountId);
  const currentMessages = messages.filter(msg => 
    msg.accountId === activeAccountId &&
    msg.folderId === (selectedFolderId || 'inbox')
  );
  const selectedMessage = messages.find(msg => msg.id === selectedMessageId);

  const handleRefresh = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await syncAllAccounts();
  }, [syncAllAccounts]);

  const handleMessagePress = useCallback((message: MailMessage) => {
    if (selectionMode) {
      toggleMessageSelection(message.id);
    } else {
      setSelectedMessage(message.id);
      setSelectedView('message');
    }
  }, [selectionMode, setSelectedMessage]);

  const handleMessageLongPress = useCallback(async (message: MailMessage) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (Platform.OS === 'ios') {
      const options = [
        'Mark as Read',
        message.isStarred ? 'Unstar' : 'Star',
        'Archive',
        'Move to Folder',
        'Delete',
        'Cancel'
      ];

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: 4, // Delete
          cancelButtonIndex: 5,
          title: `Message from ${message.fromAddress}`,
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 0:
              handleMarkAsRead(message.id);
              break;
            case 1:
              handleStarMessage(message.id);
              break;
            case 2:
              handleArchiveMessage(message.id);
              break;
            case 3:
              showMoveToFolderOptions(message.id);
              break;
            case 4:
              handleDeleteMessage(message.id);
              break;
          }
        }
      );
    } else {
      // For Android, enter selection mode
      setSelectionMode(true);
      setSelectedMessages(new Set([message.id]));
    }
  }, []);

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedView('list');
    setSelectedMessage('');
  }, [setSelectedMessage]);

  const handleMarkAsRead = useCallback(async (messageId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markAsRead(messageId);
  }, [markAsRead]);

  const handleStarMessage = useCallback(async (messageId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await starMessage(messageId);
  }, [starMessage]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await deleteMessage(messageId);
            if (selectedMessageId === messageId) {
              handleBackToList();
            }
          },
        },
      ]
    );
  }, [deleteMessage, selectedMessageId, handleBackToList]);

  const handleArchiveMessage = useCallback(async (messageId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await archiveMessage(messageId);
    
    // Close swipeable
    const swipeable = swipeableRefs.current.get(messageId);
    swipeable?.close();
  }, [archiveMessage]);

  const showMoveToFolderOptions = useCallback((messageId: string) => {
    const folders = activeAccount?.folders || [];
    const folderOptions = folders.map(f => f.displayName).concat(['Cancel']);
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: folderOptions,
          cancelButtonIndex: folderOptions.length - 1,
          title: 'Move to Folder',
        },
        (buttonIndex) => {
          if (buttonIndex < folders.length) {
            moveMessage(messageId, folders[buttonIndex].id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      );
    }
  }, [activeAccount, moveMessage]);

  const renderRightActions = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return null;

    const rightActions: SwipeAction[] = [
      {
        id: 'archive',
        label: 'Archive',
        icon: 'archive',
        color: '#FFFFFF',
        backgroundColor: '#4CAF50',
        action: handleArchiveMessage,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'trash',
        color: '#FFFFFF',
        backgroundColor: '#F44336',
        action: handleDeleteMessage,
      },
    ];

    return (
      <View style={styles.swipeActions}>
        {rightActions.map((action) => (
          <Animated.View key={action.id} style={[styles.swipeAction]}>
            <TouchableOpacity
              style={[
                styles.swipeActionButton,
                { backgroundColor: action.backgroundColor }
              ]}
              onPress={() => action.action(messageId)}
            >
              <Ionicons name={action.icon as any} size={20} color={action.color} />
              <Text style={[styles.swipeActionText, { color: action.color }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    );
  }, [messages, handleArchiveMessage, handleDeleteMessage]);

  const renderLeftActions = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return null;

    const leftActions: SwipeAction[] = [
      {
        id: 'read',
        label: message.isRead ? 'Unread' : 'Read',
        icon: message.isRead ? 'mail' : 'mail-open',
        color: '#FFFFFF',
        backgroundColor: '#2196F3',
        action: handleMarkAsRead,
      },
      {
        id: 'star',
        label: message.isStarred ? 'Unstar' : 'Star',
        icon: message.isStarred ? 'star' : 'star-outline',
        color: '#FFFFFF',
        backgroundColor: '#FF9800',
        action: handleStarMessage,
      },
    ];

    return (
      <View style={styles.swipeActions}>
        {leftActions.map((action) => (
          <Animated.View key={action.id} style={[styles.swipeAction]}>
            <TouchableOpacity
              style={[
                styles.swipeActionButton,
                { backgroundColor: action.backgroundColor }
              ]}
              onPress={() => action.action(messageId)}
            >
              <Ionicons name={action.icon as any} size={20} color={action.color} />
              <Text style={[styles.swipeActionText, { color: action.color }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    );
  }, [messages, handleMarkAsRead, handleStarMessage]);

  const formatDate = useCallback((date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (now.getTime() - messageDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, []);

  const MessageItem = useCallback(({ item: message }: { item: MailMessage }) => {
    const isSelected = selectedMessages.has(message.id);
    
    return (
      <Swipeable
        ref={(ref) => {
          if (ref) {
            swipeableRefs.current.set(message.id, ref);
          } else {
            swipeableRefs.current.delete(message.id);
          }
        }}
        renderRightActions={() => renderRightActions(message.id)}
        renderLeftActions={() => renderLeftActions(message.id)}
        friction={2}
        leftThreshold={SWIPE_THRESHOLD}
        rightThreshold={SWIPE_THRESHOLD}
      >
        <TouchableOpacity
          style={[
            styles.messageItem,
            !message.isRead && styles.messageItemUnread,
            message.id === selectedMessageId && styles.messageItemSelected,
            isSelected && styles.messageItemSelected,
            { backgroundColor: theme.colors.surface },
          ]}
          onPress={() => handleMessagePress(message)}
          onLongPress={() => handleMessageLongPress(message)}
          activeOpacity={0.7}
        >
          {selectionMode && (
            <View style={styles.selectionIndicator}>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
            </View>
          )}
          
          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <Text
                style={[
                  styles.messageSender,
                  { color: theme.colors.onSurface },
                  !message.isRead && styles.messageSenderUnread,
                ]}
                numberOfLines={1}
              >
                {message.fromAddress}
              </Text>
              <View style={styles.messageActions}>
                <Text style={[styles.messageDate, { color: theme.colors.onSurfaceVariant }]}>
                  {formatDate(message.receivedAt)}
                </Text>
                {message.isStarred && (
                  <Ionicons name="star" size={16} color={theme.colors.primary} />
                )}
              </View>
            </View>
            
            <Text
              style={[
                styles.messageSubject,
                { color: theme.colors.onSurface },
                !message.isRead && styles.messageSubjectUnread,
              ]}
              numberOfLines={1}
            >
              {message.subject}
            </Text>
            
            <Text 
              style={[styles.messageSnippet, { color: theme.colors.onSurfaceVariant }]} 
              numberOfLines={2}
            >
              {message.snippet || message.body.substring(0, 100)}
            </Text>
            
            {!message.isRead && (
              <View style={[styles.unreadIndicator, { backgroundColor: theme.colors.primary }]} />
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }, [
    selectedMessages,
    selectedMessageId,
    selectionMode,
    theme.colors,
    handleMessagePress,
    handleMessageLongPress,
    renderRightActions,
    renderLeftActions,
    formatDate,
  ]);

  const renderHeader = useCallback(() => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline }]}>
      <View style={styles.headerLeft}>
        {selectionMode ? (
          <TouchableOpacity onPress={clearSelection} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
        ) : (
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Mail</Text>
            {activeAccount && (
              <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                {activeAccount.displayName}
              </Text>
            )}
          </View>
        )}
      </View>
      
      <View style={styles.headerActions}>
        {selectionMode ? (
          <>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => {
                selectedMessages.forEach(id => markAsRead(id));
                clearSelection();
              }}
              disabled={selectedMessages.size === 0}
            >
              <Ionicons 
                name="mail-open" 
                size={20} 
                color={selectedMessages.size > 0 ? theme.colors.onSurface : theme.colors.onSurfaceVariant} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => {
                selectedMessages.forEach(id => archiveMessage(id));
                clearSelection();
              }}
              disabled={selectedMessages.size === 0}
            >
              <Ionicons 
                name="archive" 
                size={20} 
                color={selectedMessages.size > 0 ? theme.colors.onSurface : theme.colors.onSurfaceVariant} 
              />
            </TouchableOpacity>
            <Text style={[styles.selectionCount, { color: theme.colors.onSurfaceVariant }]}>
              {selectedMessages.size}
            </Text>
          </>
        ) : (
          <>
            {isSyncing && (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            )}
            <TouchableOpacity
              style={[styles.composeButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowComposeModal(true)}
            >
              <Ionicons name="create-outline" size={20} color={theme.colors.onPrimary} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  ), [
    selectionMode,
    selectedMessages,
    theme.colors,
    activeAccount,
    isSyncing,
    clearSelection,
    markAsRead,
    archiveMessage,
  ]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      minHeight: 64,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      padding: theme.spacing.xs,
      marginRight: theme.spacing.sm,
    },
    headerTitle: {
      fontSize: theme.typography.sizes.xl,
      fontWeight: theme.typography.weights.bold,
    },
    headerSubtitle: {
      fontSize: theme.typography.sizes.sm,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    composeButton: {
      borderRadius: theme.borderRadius.full,
      padding: theme.spacing.sm,
    },
    selectionCount: {
      fontSize: theme.typography.sizes.sm,
      minWidth: 30,
      textAlign: 'center',
    },
    messagesList: {
      flex: 1,
    },
    messageItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outline,
    },
    messageItemUnread: {
      backgroundColor: theme.colors.primaryContainer + '20',
    },
    messageItemSelected: {
      backgroundColor: theme.colors.primaryContainer,
    },
    selectionIndicator: {
      marginRight: theme.spacing.md,
    },
    messageContent: {
      flex: 1,
      position: 'relative',
    },
    messageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    messageSender: {
      flex: 1,
      fontSize: theme.typography.sizes.base,
    },
    messageSenderUnread: {
      fontWeight: theme.typography.weights.semibold,
    },
    messageActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    messageDate: {
      fontSize: theme.typography.sizes.sm,
    },
    messageSubject: {
      fontSize: theme.typography.sizes.base,
      marginBottom: theme.spacing.xs,
    },
    messageSubjectUnread: {
      fontWeight: theme.typography.weights.medium,
    },
    messageSnippet: {
      fontSize: theme.typography.sizes.sm,
      lineHeight: 18,
    },
    unreadIndicator: {
      position: 'absolute',
      left: -theme.spacing.sm,
      top: '50%',
      width: 4,
      height: 4,
      borderRadius: 2,
      transform: [{ translateY: -2 }],
    },
    swipeActions: {
      flexDirection: 'row',
    },
    swipeAction: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    swipeActionButton: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      paddingHorizontal: theme.spacing.sm,
    },
    swipeActionText: {
      fontSize: theme.typography.sizes.xs,
      marginTop: theme.spacing.xs,
      textAlign: 'center',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    emptyStateText: {
      fontSize: theme.typography.sizes.base,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: theme.spacing.md,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.onSurfaceVariant,
    },
  });

  if (!activeAccount) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="mail-outline" size={64} color={theme.colors.onSurfaceVariant} />
          <Text style={styles.emptyStateText}>
            No mail accounts configured.{'\n'}Add an account to get started.
          </Text>
          <TouchableOpacity
            style={[styles.composeButton, { backgroundColor: theme.colors.primary, marginTop: theme.spacing.lg }]}
            onPress={() => setShowAddAccountModal(true)}
          >
            <Text style={[{ color: theme.colors.onPrimary, paddingHorizontal: theme.spacing.md }]}>
              Add Account
            </Text>
          </TouchableOpacity>
        </View>
        
        <AddAccountModal
          visible={showAddAccountModal}
          onClose={() => setShowAddAccountModal(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        
        {isLoading && currentMessages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlashList
            data={currentMessages}
            renderItem={MessageItem}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={isSyncing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
            estimatedItemSize={100}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={64} color={theme.colors.onSurfaceVariant} />
                <Text style={styles.emptyStateText}>
                  No messages in this folder
                </Text>
              </View>
            )}
          />
        )}

        <ComposeModal
          visible={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          account={activeAccount}
        />

        <AddAccountModal
          visible={showAddAccountModal}
          onClose={() => setShowAddAccountModal(false)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}