import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  createCalendarAccount,
  updateCalendarAccount,
  deleteCalendarAccount,
  syncCalendarAccount
} from '../../store/slices/calendarSlice'
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Avatar,
  AvatarFallback,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Alert,
  AlertDescription,
  Progress
} from '../ui'
import {
  Plus,
  Settings,
  RotateCcw as Sync,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
  Clock,
  Users,
  Calendar
} from 'lucide-react'
import type { 
  CalendarProvider,
  CalendarAccount,
  CreateCalendarAccountInput,
  UpdateCalendarAccountInput,
  CalendarAccountStatus 
} from '@flow-desk/shared'

interface CalendarProviderManagerProps {
  isOpen: boolean
  onClose: () => void
}

interface ProviderConfig {
  provider: CalendarProvider
  name: string
  description: string
  icon: string
  color: string
  capabilities: {
    twoWaySync: boolean
    webhooks: boolean
    freeBusy: boolean
    attachments: boolean
    recurring: boolean
    reminders: boolean
  }
  setupSteps: string[]
  authType: 'oauth' | 'basic' | 'token'
  isEnterprise?: boolean
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    provider: 'google',
    name: 'Google Calendar',
    description: 'Sync with Google Calendar and Gmail',
    icon: '🗓️',
    color: 'bg-blue-500',
    capabilities: {
      twoWaySync: true,
      webhooks: true,
      freeBusy: true,
      attachments: true,
      recurring: true,
      reminders: true
    },
    setupSteps: [
      'Sign in to your Google account',
      'Grant calendar and email permissions',
      'Select calendars to sync'
    ],
    authType: 'oauth'
  },
  {
    provider: 'outlook',
    name: 'Microsoft Outlook',
    description: 'Connect to Outlook.com or Office 365',
    icon: '📅',
    color: 'bg-blue-600',
    capabilities: {
      twoWaySync: true,
      webhooks: true,
      freeBusy: true,
      attachments: true,
      recurring: true,
      reminders: true
    },
    setupSteps: [
      'Sign in to your Microsoft account',
      'Choose personal or work account',
      'Authorize calendar access',
      'Configure sync settings'
    ],
    authType: 'oauth',
    isEnterprise: true
  },
  {
    provider: 'exchange',
    name: 'Exchange Server',
    description: 'Connect to on-premises Exchange',
    icon: '🏢',
    color: 'bg-gray-600',
    capabilities: {
      twoWaySync: true,
      webhooks: false,
      freeBusy: true,
      attachments: true,
      recurring: true,
      reminders: true
    },
    setupSteps: [
      'Enter Exchange server details',
      'Provide domain credentials',
      'Test connection',
      'Configure sync preferences'
    ],
    authType: 'basic',
    isEnterprise: true
  },
  {
    provider: 'icloud',
    name: 'iCloud Calendar',
    description: 'Sync with Apple iCloud calendars',
    icon: '☁️',
    color: 'bg-gray-500',
    capabilities: {
      twoWaySync: true,
      webhooks: false,
      freeBusy: false,
      attachments: false,
      recurring: true,
      reminders: true
    },
    setupSteps: [
      'Enable two-factor authentication',
      'Generate app-specific password',
      'Enter iCloud credentials',
      'Select calendars to sync'
    ],
    authType: 'basic'
  },
  {
    provider: 'caldav',
    name: 'CalDAV',
    description: 'Generic CalDAV server connection',
    icon: '🔗',
    color: 'bg-green-600',
    capabilities: {
      twoWaySync: true,
      webhooks: false,
      freeBusy: false,
      attachments: false,
      recurring: true,
      reminders: false
    },
    setupSteps: [
      'Enter CalDAV server URL',
      'Provide authentication credentials',
      'Test connection',
      'Import available calendars'
    ],
    authType: 'basic'
  },
  {
    provider: 'fastmail',
    name: 'Fastmail',
    description: 'Connect to Fastmail calendar service',
    icon: '⚡',
    color: 'bg-purple-600',
    capabilities: {
      twoWaySync: true,
      webhooks: false,
      freeBusy: true,
      attachments: false,
      recurring: true,
      reminders: true
    },
    setupSteps: [
      'Generate app password in Fastmail',
      'Enter Fastmail credentials',
      'Configure calendar settings',
      'Test synchronization'
    ],
    authType: 'basic'
  }
]

export const CalendarProviderManager: React.FC<CalendarProviderManagerProps> = ({
  isOpen,
  onClose
}) => {
  const dispatch = useAppDispatch()
  const { accounts, syncStatus } = useAppSelector(state => state.calendar)
  
  const [selectedTab, setSelectedTab] = useState('accounts')
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const getStatusColor = (status: CalendarAccountStatus) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200'
      case 'auth_error': return 'text-red-600 bg-red-50 border-red-200'
      case 'quota_exceeded': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'suspended': return 'text-gray-600 bg-gray-50 border-gray-200'
      case 'disabled': return 'text-gray-600 bg-gray-50 border-gray-200'
      case 'error': return 'text-red-600 bg-red-50 border-red-200'
    }
  }

  const getStatusIcon = (status: CalendarAccountStatus) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />
      case 'auth_error': return <AlertTriangle className="h-4 w-4" />
      case 'quota_exceeded': return <AlertTriangle className="h-4 w-4" />
      case 'suspended': return <AlertTriangle className="h-4 w-4" />
      case 'disabled': return <AlertTriangle className="h-4 w-4" />
      case 'error': return <AlertTriangle className="h-4 w-4" />
    }
  }

  const handleSyncAccount = useCallback(async (accountId: string) => {
    try {
      await dispatch(syncCalendarAccount({ accountId, force: true })).unwrap()
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }, [dispatch])

  const handleDeleteAccount = useCallback(async (accountId: string) => {
    if (confirm('Are you sure you want to remove this calendar account? This will stop syncing all calendars from this account.')) {
      try {
        await dispatch(deleteCalendarAccount(accountId)).unwrap()
      } catch (error) {
        console.error('Delete failed:', error)
      }
    }
  }, [dispatch])

  const handleConnectProvider = useCallback(async (provider: ProviderConfig) => {
    setIsConnecting(true)
    try {
      // In real app, this would start OAuth flow or show credential form
      const accountData: CreateCalendarAccountInput = {
        userId: 'current_user', // Replace with actual user ID
        name: `${provider.name} Account`,
        email: 'user@example.com', // Would be filled from OAuth
        provider: provider.provider,
        config: {
          provider: provider.provider,
          // Provider-specific config would be filled here
        } as any,
        status: 'active',
        syncIntervalMinutes: 15,
        isEnabled: true
      }

      await dispatch(createCalendarAccount(accountData)).unwrap()
      setShowAddProvider(false)
      setSelectedProvider(null)
    } catch (error) {
      console.error('Connection failed:', error)
    } finally {
      setIsConnecting(false)
    }
  }, [dispatch])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Calendar Providers
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="accounts">Connected Accounts</TabsTrigger>
            <TabsTrigger value="providers">Available Providers</TabsTrigger>
            <TabsTrigger value="sync">Sync Status</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Your Calendar Accounts</h4>
              <Button onClick={() => setShowAddProvider(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Account
              </Button>
            </div>

            {accounts.length === 0 ? (
              <Card className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h4 className="font-medium mb-2">No calendar accounts connected</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your calendar accounts to start syncing events
                </p>
                <Button onClick={() => setShowAddProvider(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Your First Account
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => {
                  const provider = PROVIDER_CONFIGS.find(p => p.provider === account.provider)
                  const status = syncStatus[account.id]

                  return (
                    <Card key={account.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Avatar className={`h-12 w-12 ${provider?.color || 'bg-gray-500'}`}>
                            <AvatarFallback className="text-white">
                              {provider?.icon || account.provider[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <h4 className="font-medium">{account.name}</h4>
                            <p className="text-sm text-muted-foreground">{account.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`text-xs ${getStatusColor(account.status)}`}>
                                {getStatusIcon(account.status)}
                                {account.status.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {provider?.name || account.provider}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={account.isEnabled}
                            onCheckedChange={(enabled) => {
                              dispatch(updateCalendarAccount({
                                accountId: account.id,
                                updates: { isEnabled: enabled }
                              }))
                            }}
                          />
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncAccount(account.id)}
                            disabled={status?.status === 'syncing'}
                          >
                            <Sync className={`h-4 w-4 ${status?.status === 'syncing' ? 'animate-spin' : ''}`} />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAccount(account.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {account.lastSyncAt && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Last synced: {new Date(account.lastSyncAt).toLocaleString()}
                        </div>
                      )}

                      {account.status === 'auth_error' && (
                        <Alert className="mt-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Authentication expired. Please reconnect your account.
                          </AlertDescription>
                        </Alert>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="providers" className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-medium mb-4">Choose a Calendar Provider</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PROVIDER_CONFIGS.map((provider) => {
                  const isConnected = accounts.some(acc => acc.provider === provider.provider)

                  return (
                    <Card
                      key={provider.provider}
                      className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${
                        selectedProvider?.provider === provider.provider ? 'border-primary' : ''
                      }`}
                      onClick={() => setSelectedProvider(provider)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className={`h-10 w-10 ${provider.color}`}>
                          <AvatarFallback className="text-white">
                            {provider.icon}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{provider.name}</h4>
                            {provider.isEnterprise && (
                              <Badge variant="outline" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Enterprise
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {provider.description}
                          </p>
                          
                          <div className="flex flex-wrap gap-1 mb-2">
                            {provider.capabilities.twoWaySync && (
                              <Badge variant="outline" className="text-xs">Two-way sync</Badge>
                            )}
                            {provider.capabilities.webhooks && (
                              <Badge variant="outline" className="text-xs">Real-time</Badge>
                            )}
                            {provider.capabilities.freeBusy && (
                              <Badge variant="outline" className="text-xs">Free/busy</Badge>
                            )}
                          </div>

                          {isConnected ? (
                            <Badge className="text-xs bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleConnectProvider(provider)
                              }}
                              disabled={isConnecting}
                            >
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>

            {selectedProvider && (
              <Card className="p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <span className="text-lg">{selectedProvider.icon}</span>
                  Setup {selectedProvider.name}
                </h4>
                <div className="space-y-2 text-sm">
                  {selectedProvider.setupSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                        {index + 1}
                      </div>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => handleConnectProvider(selectedProvider)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Connecting...' : 'Start Setup'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`https://help.flowdesk.app/calendar/${selectedProvider.provider}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Setup Guide
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sync" className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-medium mb-4">Synchronization Status</h4>
              
              {Object.entries(syncStatus).length === 0 ? (
                <Card className="p-8 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No active synchronization processes
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {Object.entries(syncStatus).map(([accountId, status]) => {
                    const account = accounts.find(acc => acc.id === accountId)
                    const provider = PROVIDER_CONFIGS.find(p => p.provider === account?.provider)

                    return (
                      <Card key={accountId} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className={`h-8 w-8 ${provider?.color || 'bg-gray-500'}`}>
                              <AvatarFallback className="text-white text-xs">
                                {provider?.icon || account?.provider[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h5 className="font-medium text-sm">{account?.name}</h5>
                              <p className="text-xs text-muted-foreground">{account?.email}</p>
                            </div>
                          </div>
                          
                          <Badge className={getStatusColor(status.status.replace('_', ' ') as CalendarAccountStatus)}>
                            {status.status === 'syncing' && <Sync className="h-3 w-3 mr-1 animate-spin" />}
                            {status.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        {status.currentOperation && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{status.currentOperation.type.replace('_', ' ')}</span>
                              <span>{status.currentOperation.progress}%</span>
                            </div>
                            <Progress value={status.currentOperation.progress} className="h-2" />
                          </div>
                        )}

                        <div className="grid grid-cols-4 gap-4 mt-3 text-xs">
                          <div>
                            <div className="font-medium text-green-600">{status.stats.newEvents}</div>
                            <div className="text-muted-foreground">New</div>
                          </div>
                          <div>
                            <div className="font-medium text-blue-600">{status.stats.updatedEvents}</div>
                            <div className="text-muted-foreground">Updated</div>
                          </div>
                          <div>
                            <div className="font-medium text-orange-600">{status.stats.deletedEvents}</div>
                            <div className="text-muted-foreground">Deleted</div>
                          </div>
                          <div>
                            <div className="font-medium text-red-600">{status.stats.syncErrors}</div>
                            <div className="text-muted-foreground">Errors</div>
                          </div>
                        </div>

                        {status.lastError && (
                          <Alert className="mt-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {status.lastError.message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}