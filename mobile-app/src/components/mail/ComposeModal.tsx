/**
 * Mail Compose Modal - Mobile-optimized rich text editor
 * 
 * Provides a full-featured email composer with rich text editing,
 * attachment support, and proper keyboard handling for mobile devices.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'react-native-image-picker';
import * as Contacts from 'expo-contacts';
import { WebView } from 'react-native-webview';
import { useStore } from '../../store';
import { mailService } from '../../services/mailService';
import type { EmailMessage, MailAccount } from '@flow-desk/shared';

interface Props {
  visible: boolean;
  onClose: () => void;
  account?: MailAccount;
  replyTo?: EmailMessage;
  forwardMessage?: EmailMessage;
  draftId?: string;
}

interface Attachment {
  id: string;
  name: string;
  uri: string;
  type: string;
  size: number;
}

interface Contact {
  name?: string;
  email: string;
}

const EDITOR_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      background-color: #ffffff;
      color: #000000;
    }
    .editor {
      min-height: 200px;
      outline: none;
      border: none;
      width: 100%;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      background-color: #f5f5f5;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .toolbar button {
      padding: 8px 12px;
      border: 1px solid #d0d0d0;
      background-color: #ffffff;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .toolbar button.active {
      background-color: #007AFF;
      color: white;
      border-color: #007AFF;
    }
    .toolbar button:hover {
      background-color: #f0f0f0;
    }
    .toolbar button.active:hover {
      background-color: #0056CC;
    }
    blockquote {
      border-left: 4px solid #ccc;
      margin: 0 0 16px 0;
      padding: 8px 16px;
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="execCommand('bold')" id="boldBtn">B</button>
    <button onclick="execCommand('italic')" id="italicBtn">I</button>
    <button onclick="execCommand('underline')" id="underlineBtn">U</button>
    <button onclick="execCommand('strikethrough')" id="strikeBtn">S</button>
    <button onclick="execCommand('insertUnorderedList')" id="ulBtn">• List</button>
    <button onclick="execCommand('insertOrderedList')" id="olBtn">1. List</button>
    <button onclick="execCommand('formatBlock', 'blockquote')" id="quoteBtn">Quote</button>
    <button onclick="insertLink()" id="linkBtn">Link</button>
  </div>
  <div class="editor" contenteditable="true" id="editor" placeholder="Compose your message..."></div>
  
  <script>
    let editor = document.getElementById('editor');
    
    function execCommand(command, value = null) {
      document.execCommand(command, false, value);
      updateToolbar();
      sendContent();
    }
    
    function insertLink() {
      let url = prompt('Enter URL:', 'https://');
      if (url && url !== 'https://') {
        execCommand('createLink', url);
      }
    }
    
    function updateToolbar() {
      const commands = {
        'boldBtn': 'bold',
        'italicBtn': 'italic',
        'underlineBtn': 'underline',
        'strikeBtn': 'strikethrough',
        'ulBtn': 'insertUnorderedList',
        'olBtn': 'insertOrderedList'
      };
      
      Object.keys(commands).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (document.queryCommandState(commands[btnId])) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
    
    function sendContent() {
      const content = editor.innerHTML;
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'contentChange',
        content: content
      }));
    }
    
    function setContent(html) {
      editor.innerHTML = html;
    }
    
    function getContent() {
      return editor.innerHTML;
    }
    
    function focus() {
      editor.focus();
    }
    
    // Send content on input
    editor.addEventListener('input', sendContent);
    editor.addEventListener('keyup', updateToolbar);
    editor.addEventListener('mouseup', updateToolbar);
    
    // Handle paste to clean up content
    editor.addEventListener('paste', function(e) {
      setTimeout(sendContent, 10);
    });
    
    // Initial focus
    setTimeout(() => {
      editor.focus();
    }, 500);
  </script>
</body>
</html>
`;

export function ComposeModal({ 
  visible, 
  onClose, 
  account, 
  replyTo, 
  forwardMessage,
  draftId 
}: Props) {
  const theme = useStore(state => state.theme);
  const accounts = useStore(state => state.accounts);
  const activeAccountId = useStore(state => state.activeAccountId);
  const sendMessage = useStore(state => state.sendMessage);
  
  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState(
    account?.id || activeAccountId || accounts[0]?.id || ''
  );
  const [to, setTo] = useState<Contact[]>([]);
  const [cc, setCc] = useState<Contact[]>([]);
  const [bcc, setBcc] = useState<Contact[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  // UI state
  const [isSending, setIsSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isEditorLoaded, setIsEditorLoaded] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const editorRef = useRef<WebView>(null);
  const screenHeight = Dimensions.get('window').height;

  // Initialize compose data
  useEffect(() => {
    if (!visible) return;

    if (replyTo) {
      setTo([{ email: replyTo.fromAddress, name: replyTo.fromAddress }]);
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
      
      const originalMessage = `
        <blockquote>
          <p><strong>From:</strong> ${replyTo.fromAddress}</p>
          <p><strong>Date:</strong> ${new Date(replyTo.receivedAt).toLocaleString()}</p>
          <p><strong>Subject:</strong> ${replyTo.subject}</p>
          <br>
          ${replyTo.body}
        </blockquote>
      `;
      setBodyHtml(originalMessage);
    } else if (forwardMessage) {
      setSubject(forwardMessage.subject.startsWith('Fwd:') ? forwardMessage.subject : `Fwd: ${forwardMessage.subject}`);
      
      const forwardedMessage = `
        <p>---------- Forwarded message ----------</p>
        <p><strong>From:</strong> ${forwardMessage.fromAddress}</p>
        <p><strong>Date:</strong> ${new Date(forwardMessage.receivedAt).toLocaleString()}</p>
        <p><strong>Subject:</strong> ${forwardMessage.subject}</p>
        <p><strong>To:</strong> ${forwardMessage.toAddresses.join(', ')}</p>
        <br>
        ${forwardMessage.body}
      `;
      setBodyHtml(forwardedMessage);
    }
  }, [visible, replyTo, forwardMessage]);

  // Keyboard handling
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const handleAddContact = useCallback(async (field: 'to' | 'cc' | 'bcc') => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to contacts to add recipients.');
        return;
      }

      // For now, show a simple text input for email
      // In a real implementation, you'd show a contact picker
      Alert.prompt(
        'Add Recipient',
        'Enter email address:',
        (email) => {
          if (email && email.includes('@')) {
            const contact = { email: email.trim(), name: email.trim() };
            
            switch (field) {
              case 'to':
                setTo(prev => [...prev, contact]);
                break;
              case 'cc':
                setCc(prev => [...prev, contact]);
                break;
              case 'bcc':
                setBcc(prev => [...prev, contact]);
                break;
            }
          }
        },
        'plain-text'
      );
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  }, []);

  const handleRemoveContact = useCallback((field: 'to' | 'cc' | 'bcc', index: number) => {
    switch (field) {
      case 'to':
        setTo(prev => prev.filter((_, i) => i !== index));
        break;
      case 'cc':
        setCc(prev => prev.filter((_, i) => i !== index));
        break;
      case 'bcc':
        setBcc(prev => prev.filter((_, i) => i !== index));
        break;
    }
  }, []);

  const handleAddAttachment = useCallback(async () => {
    Alert.alert(
      'Add Attachment',
      'Choose attachment type:',
      [
        {
          text: 'Document',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
              });
              
              if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const attachment: Attachment = {
                  id: `attach_${Date.now()}`,
                  name: asset.name,
                  uri: asset.uri,
                  type: asset.mimeType || 'application/octet-stream',
                  size: asset.size || 0,
                };
                setAttachments(prev => [...prev, attachment]);
              }
            } catch (error) {
              console.error('Error picking document:', error);
            }
          },
        },
        {
          text: 'Photo',
          onPress: async () => {
            try {
              const options = {
                mediaType: 'photo' as const,
                includeBase64: false,
                maxHeight: 2000,
                maxWidth: 2000,
              };

              ImagePicker.launchImageLibrary(options, (response) => {
                if (response.assets && response.assets[0]) {
                  const asset = response.assets[0];
                  const attachment: Attachment = {
                    id: `attach_${Date.now()}`,
                    name: asset.fileName || 'image.jpg',
                    uri: asset.uri!,
                    type: asset.type || 'image/jpeg',
                    size: asset.fileSize || 0,
                  };
                  setAttachments(prev => [...prev, attachment]);
                }
              });
            } catch (error) {
              console.error('Error picking image:', error);
            }
          },
        },
        {
          text: 'Camera',
          onPress: async () => {
            try {
              const options = {
                mediaType: 'photo' as const,
                includeBase64: false,
                maxHeight: 2000,
                maxWidth: 2000,
              };

              ImagePicker.launchCamera(options, (response) => {
                if (response.assets && response.assets[0]) {
                  const asset = response.assets[0];
                  const attachment: Attachment = {
                    id: `attach_${Date.now()}`,
                    name: asset.fileName || 'camera.jpg',
                    uri: asset.uri!,
                    type: asset.type || 'image/jpeg',
                    size: asset.fileSize || 0,
                  };
                  setAttachments(prev => [...prev, attachment]);
                }
              });
            } catch (error) {
              console.error('Error taking photo:', error);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  }, []);

  const handleSend = useCallback(async () => {
    if (to.length === 0) {
      Alert.alert('Error', 'Please add at least one recipient.');
      return;
    }

    if (!subject.trim()) {
      Alert.alert('Error', 'Please add a subject.');
      return;
    }

    setIsSending(true);

    try {
      const selectedAccount = accounts.find(a => a.id === selectedAccountId);
      if (!selectedAccount) {
        throw new Error('Please select an account to send from.');
      }

      const message = {
        to: to.map(c => c.email),
        cc: cc.map(c => c.email),
        bcc: bcc.map(c => c.email),
        subject: subject.trim(),
        body: bodyHtml,
        attachments: attachments.map(a => ({
          filename: a.name,
          path: a.uri,
          contentType: a.type,
        })),
      };

      await mailService.sendMessage(selectedAccountId, message);

      Alert.alert('Success', 'Message sent successfully!', [
        { text: 'OK', onPress: onClose },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send message'
      );
    } finally {
      setIsSending(false);
    }
  }, [to, cc, bcc, subject, bodyHtml, attachments, selectedAccountId, accounts, onClose]);

  const handleSaveDraft = useCallback(async () => {
    try {
      const draft = {
        to: to.map(c => c.email),
        cc: cc.map(c => c.email),
        bcc: bcc.map(c => c.email),
        subject: subject.trim(),
        body: bodyHtml,
        attachments: attachments.map(a => ({
          filename: a.name,
          path: a.uri,
          contentType: a.type,
        })),
      };

      await mailService.saveDraft(selectedAccountId, JSON.stringify(draft));
      Alert.alert('Success', 'Draft saved successfully!');
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [to, cc, bcc, subject, bodyHtml, attachments, selectedAccountId]);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'contentChange') {
        setBodyHtml(data.content);
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  }, []);

  const ContactChip = ({ contact, onRemove }: { contact: Contact; onRemove: () => void }) => (
    <View style={[styles.contactChip, { backgroundColor: theme.colors.primaryContainer }]}>
      <Text style={[styles.contactChipText, { color: theme.colors.onPrimaryContainer }]}>
        {contact.name || contact.email}
      </Text>
      <TouchableOpacity onPress={onRemove} style={styles.contactChipRemove}>
        <Ionicons name="close" size={14} color={theme.colors.onPrimaryContainer} />
      </TouchableOpacity>
    </View>
  );

  const RecipientField = ({ 
    label, 
    contacts, 
    onAddContact, 
    onRemoveContact,
    placeholder 
  }: {
    label: string;
    contacts: Contact[];
    onAddContact: () => void;
    onRemoveContact: (index: number) => void;
    placeholder: string;
  }) => (
    <View style={styles.recipientField}>
      <Text style={[styles.recipientLabel, { color: theme.colors.onSurface }]}>
        {label}
      </Text>
      <View style={styles.recipientContent}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.contactsList}
          contentContainerStyle={styles.contactsListContent}
        >
          {contacts.map((contact, index) => (
            <ContactChip
              key={index}
              contact={contact}
              onRemove={() => onRemoveContact(index)}
            />
          ))}
          <TouchableOpacity
            style={[styles.addContactButton, { borderColor: theme.colors.outline }]}
            onPress={onAddContact}
          >
            <Text style={[styles.addContactText, { color: theme.colors.onSurfaceVariant }]}>
              {contacts.length === 0 ? placeholder : '+'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    headerTitle: {
      fontSize: theme.typography.sizes.lg,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.onSurface,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    actionButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    cancelButton: {
      backgroundColor: 'transparent',
    },
    cancelButtonText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.sizes.base,
    },
    draftButton: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    draftButtonText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.sizes.base,
    },
    sendButton: {
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    sendButtonText: {
      color: theme.colors.onPrimary,
      fontSize: theme.typography.sizes.base,
      fontWeight: theme.typography.weights.medium,
    },
    sendButtonDisabled: {
      opacity: 0.6,
    },
    content: {
      flex: 1,
    },
    formSection: {
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    accountSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    accountLabel: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.onSurfaceVariant,
      marginRight: theme.spacing.md,
      width: 50,
    },
    subjectField: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    subjectLabel: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.onSurfaceVariant,
      marginRight: theme.spacing.md,
      width: 50,
    },
    subjectInput: {
      flex: 1,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.onSurface,
      padding: 0,
    },
    recipientField: {
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    recipientLabel: {
      fontSize: theme.typography.sizes.sm,
      marginBottom: theme.spacing.xs,
    },
    recipientContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    contactsList: {
      flex: 1,
    },
    contactsListContent: {
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    contactChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      gap: theme.spacing.xs,
    },
    contactChipText: {
      fontSize: theme.typography.sizes.sm,
    },
    contactChipRemove: {
      padding: 2,
    },
    addContactButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      borderStyle: 'dashed',
    },
    addContactText: {
      fontSize: theme.typography.sizes.sm,
    },
    ccBccButtons: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginLeft: theme.spacing.md,
    },
    ccBccButton: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    ccBccButtonText: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.primary,
    },
    editorContainer: {
      flex: 1,
      marginBottom: keyboardHeight,
    },
    editor: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    attachmentsContainer: {
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    attachmentsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    attachmentsTitle: {
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.onSurface,
    },
    addAttachmentButton: {
      padding: theme.spacing.xs,
    },
    attachmentsList: {
      gap: theme.spacing.xs,
    },
    attachmentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.borderRadius.md,
    },
    attachmentInfo: {
      flex: 1,
      marginLeft: theme.spacing.sm,
    },
    attachmentName: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.onSurfaceVariant,
    },
    attachmentSize: {
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.onSurfaceVariant,
      opacity: 0.7,
    },
    removeAttachmentButton: {
      padding: theme.spacing.xs,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.onSurface,
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay} edges={['top']}>
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={onClose}
                disabled={isSending}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.draftButton]}
                onPress={handleSaveDraft}
                disabled={isSending}
              >
                <Text style={styles.draftButtonText}>Draft</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.headerTitle}>Compose</Text>

            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.sendButton,
                isSending && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={isSending || to.length === 0 || !subject.trim()}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
              ) : (
                <Ionicons name="send" size={16} color={theme.colors.onPrimary} />
              )}
              <Text style={styles.sendButtonText}>
                {isSending ? 'Sending...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Form Section */}
            <View style={styles.formSection}>
              {/* Account Selector */}
              <View style={styles.accountSelector}>
                <Text style={styles.accountLabel}>From:</Text>
                {/* Account picker would go here */}
                <Text style={[{ color: theme.colors.onSurface }]}>
                  {accounts.find(a => a.id === selectedAccountId)?.email || 'Select account'}
                </Text>
              </View>

              {/* Recipients */}
              <RecipientField
                label="To:"
                contacts={to}
                onAddContact={() => handleAddContact('to')}
                onRemoveContact={(index) => handleRemoveContact('to', index)}
                placeholder="Add recipients"
              />

              {/* CC/BCC Toggle */}
              {!showCc && !showBcc && (
                <View style={styles.ccBccButtons}>
                  <TouchableOpacity
                    style={styles.ccBccButton}
                    onPress={() => setShowCc(true)}
                  >
                    <Text style={styles.ccBccButtonText}>Cc</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.ccBccButton}
                    onPress={() => setShowBcc(true)}
                  >
                    <Text style={styles.ccBccButtonText}>Bcc</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* CC Field */}
              {showCc && (
                <RecipientField
                  label="Cc:"
                  contacts={cc}
                  onAddContact={() => handleAddContact('cc')}
                  onRemoveContact={(index) => handleRemoveContact('cc', index)}
                  placeholder="Add Cc recipients"
                />
              )}

              {/* BCC Field */}
              {showBcc && (
                <RecipientField
                  label="Bcc:"
                  contacts={bcc}
                  onAddContact={() => handleAddContact('bcc')}
                  onRemoveContact={(index) => handleRemoveContact('bcc', index)}
                  placeholder="Add Bcc recipients"
                />
              )}

              {/* Subject */}
              <View style={styles.subjectField}>
                <Text style={styles.subjectLabel}>Subject:</Text>
                <TextInput
                  style={styles.subjectInput}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Subject"
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                />
              </View>
            </View>

            {/* Rich Text Editor */}
            <View style={styles.editorContainer}>
              <WebView
                ref={editorRef}
                source={{ html: EDITOR_HTML }}
                style={styles.editor}
                onMessage={handleWebViewMessage}
                onLoadEnd={() => {
                  setIsEditorLoaded(true);
                  if (bodyHtml) {
                    editorRef.current?.postMessage(`setContent('${bodyHtml.replace(/'/g, "\\'")}')`);
                  }
                }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                scalesPageToFit={false}
                showsVerticalScrollIndicator={false}
              />
            </View>

            {/* Attachments */}
            {(attachments.length > 0 || true) && (
              <View style={styles.attachmentsContainer}>
                <View style={styles.attachmentsHeader}>
                  <Text style={styles.attachmentsTitle}>
                    Attachments ({attachments.length})
                  </Text>
                  <TouchableOpacity
                    style={styles.addAttachmentButton}
                    onPress={handleAddAttachment}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.attachmentsList}>
                  {attachments.map((attachment) => (
                    <View key={attachment.id} style={styles.attachmentItem}>
                      <Ionicons
                        name="document-attach"
                        size={16}
                        color={theme.colors.onSurfaceVariant}
                      />
                      <View style={styles.attachmentInfo}>
                        <Text style={styles.attachmentName}>{attachment.name}</Text>
                        <Text style={styles.attachmentSize}>
                          {formatFileSize(attachment.size)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeAttachmentButton}
                        onPress={() => handleRemoveAttachment(attachment.id)}
                      >
                        <Ionicons name="close" size={16} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Loading Overlay */}
          {isSending && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Sending message...</Text>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}