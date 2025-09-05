/*!
 * Add Calendar Account Modal
 * 
 * Modal component for adding new calendar accounts with OAuth2 authentication.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch } from '../../store'
import { createCalendarAccount } from '../../store/slices/calendarSlice'
import {
  Button,
  Card,
  Input,
  cn,
  X
} from '../ui'
import { Modal } from '../ui/Modal'
import type {
  CalendarProvider,
  CreateCalendarAccountInput
} from '@flow-desk/shared'

interface AddCalendarAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const PROVIDER_INFO = {
  google: {
    name: 'Google Calendar',
    description: 'Connect your Google Calendar account',
    icon: '🔵',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ]
  },
  outlook: {
    name: 'Microsoft Outlook',
    description: 'Connect your Microsoft 365 or Outlook.com account',
    icon: '🔷',
    scopes: [
      'https://graph.microsoft.com/calendars.readwrite',
      'https://graph.microsoft.com/user.read'
    ]
  },
  caldav: {
    name: 'CalDAV',
    description: 'Connect to iCloud, Fastmail, or other CalDAV servers',
    icon: '📅',
    scopes: []
  }
}

export const AddCalendarAccountModal: React.FC<AddCalendarAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const dispatch = useAppDispatch()
  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider | null>(null)
  const [accountName, setAccountName] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // CalDAV specific fields
  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleProviderSelect = useCallback((provider: CalendarProvider) => {
    setSelectedProvider(provider)
    setError(null)
    
    // Pre-fill some defaults based on provider
    if (provider === 'google') {
      setAccountName('Google Calendar')
    } else if (provider === 'outlook') {
      setAccountName('Microsoft Outlook')
    } else if (provider === 'caldav') {
      setAccountName('CalDAV Account')
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!selectedProvider) {
      setError('Please select a calendar provider')
      return
    }

    if (!accountName.trim()) {
      setError('Please enter an account name')
      return
    }

    if (!email.trim() && selectedProvider !== 'caldav') {
      setError('Please enter your email address')
      return
    }

    if (selectedProvider === 'caldav') {
      if (!serverUrl.trim()) {
        setError('Please enter the CalDAV server URL')
        return
      }
      if (!username.trim()) {
        setError('Please enter your username')
        return
      }
      if (!password.trim()) {
        setError('Please enter your password')
        return
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      const accountData: CreateCalendarAccountInput = {
        userId: 'current_user', // Replace with actual user ID
        name: accountName.trim(),
        email: selectedProvider === 'caldav' ? username.trim() : email.trim(),
        provider: selectedProvider,
        config: createProviderConfig(selectedProvider),
        status: 'active',
        syncIntervalMinutes: 15,
        isEnabled: true
      }

      const result = await dispatch(createCalendarAccount(accountData)).unwrap()
      
      // Success!
      onSuccess?.()
      onClose()
      resetForm()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add calendar account')
    } finally {
      setIsLoading(false)
    }
  }, [
    selectedProvider,
    accountName,
    email,
    serverUrl,
    username,
    password,
    dispatch,
    onSuccess,
    onClose
  ])

  const createProviderConfig = (provider: CalendarProvider) => {
    switch (provider) {
      case 'google':
        return {
          provider: 'google' as const,
          clientId: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
          scopes: PROVIDER_INFO.google.scopes,
          enablePushNotifications: true
        }
      case 'outlook':
        return {
          provider: 'outlook' as const,
          clientId: process.env.MICROSOFT_CLIENT_ID || 'your-microsoft-client-id',
          scopes: PROVIDER_INFO.outlook.scopes,
          enableWebhooks: true
        }
      case 'caldav':
        return {
          provider: 'caldav' as const,
          serverUrl: serverUrl.trim(),
          auth: {
            username: username.trim(),
            password: password.trim() // This will be encrypted by the backend
          },
          features: {
            supportsScheduling: true,
            supportsFreeBusy: false,
            supportsTasks: false
          }
        }
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  const resetForm = useCallback(() => {
    setSelectedProvider(null)
    setAccountName('')
    setEmail('')
    setServerUrl('')
    setUsername('')
    setPassword('')
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Calendar Account"
      description="Connect your calendar account to sync events and manage your schedule"
      size="lg"
      className="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Provider Selection */}
        <div>
          <h3 className="text-sm font-medium mb-3">Select Calendar Provider</h3>
          <div className="grid grid-cols-1 gap-3">
            {(Object.entries(PROVIDER_INFO) as [CalendarProvider, any][]).map(([provider, info]) => (
              <div
                key={provider}
                className={cn(
                  'p-3 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md',
                  selectedProvider === provider ? 'border-primary bg-primary/10' : 'border-border'
                )}
                onClick={() => handleProviderSelect(provider)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{info.name}</h4>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account Configuration */}
        {selectedProvider && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Account Configuration</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Enter a name for this account"
                required
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>

            {selectedProvider !== 'caldav' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                />
              </div>
            )}

            {selectedProvider === 'caldav' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CalDAV Server URL</label>
                  <input
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://caldav.example.com/calendar"
                    required
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your.username"
                      required
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="your.password"
                      required
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>
                </div>
              </>
            )}

            {/* OAuth2 Info */}
            {(selectedProvider === 'google' || selectedProvider === 'outlook') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-500">ℹ️</span>
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">OAuth2 Authentication</p>
                    <p className="text-blue-700 mt-1">
                      After clicking "Add Account", you'll be redirected to {PROVIDER_INFO[selectedProvider].name} 
                      to grant calendar access permissions.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-red-500">⚠️</span>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={!selectedProvider || isLoading}
          >
            {isLoading ? 'Adding Account...' : 'Add Account'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}