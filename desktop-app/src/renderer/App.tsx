import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react'
import { Provider } from 'react-redux'
import { store } from './store'
import { useAppDispatch, useAppSelector } from './store'
import { loadThemeSettings, applyTheme } from './store/slices/themeSlice'
import { loadWorkspaces, switchWorkspace } from './store/slices/workspaceSlice'
import {
  PluginPanels,
  NotificationsHub,
  SearchInterface,
  SettingsPanels,
  cn
} from './components'
import { AccessibilityProvider } from './contexts/AccessibilityContext'
import ColorBlindnessFilters from './components/accessibility/ColorBlindnessFilters'
import AccessibilitySettings from './components/accessibility/AccessibilitySettings'
import { NotificationContainer } from './components/ui/NotificationSystem'
import { ErrorBoundary, MailErrorBoundary, CalendarErrorBoundary, WorkspaceErrorBoundary } from './components/ui/ErrorBoundary'
import { KeyboardShortcutManager, commonShortcuts, useKeyboardShortcuts } from './components/ui/KeyboardShortcuts'
import { LoadingOverlay } from './components/ui/LoadingStates'
import { AdvancedSearchInterface } from './components/search/AdvancedSearchInterface'
import type { SearchResult, SearchFilters } from './components/search/AdvancedSearchInterface'
import { getZIndexClass } from './constants/zIndex'
import { useBlockingOverlay } from './hooks/useBrowserViewVisibility'

// Lazy load heavy components to reduce initial bundle size
const MailLayout = lazy(() => import('./components/mail/MailLayout').then(m => ({ default: m.MailLayout })))
const CalendarViews = lazy(() => import('./components/calendar/CalendarViews').then(m => ({ default: m.CalendarViews })))

// Loading fallback component
const ComponentLoader: React.FC<{ name: string }> = ({ name }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center">
      <div className="text-2xl mb-2">⏳</div>
      <p className="text-sm text-muted-foreground">Loading {name}...</p>
    </div>
  </div>
)
import FlowDeskLeftRail from './components/layout/FlowDeskLeftRail'
import ServicesSidebar from './components/layout/ServicesSidebar'
import AddServiceModal from './components/workspace/AddServiceModal'
import EditServiceModal from './components/workspace/EditServiceModal'
import SimpleMailAccountModal from './components/mail/SimpleMailAccountModal'
import { useMemoryCleanup } from './hooks/useMemoryCleanup'
import { usePerformanceMonitor, useBundleMonitor } from './hooks/usePerformanceMonitor'
import type { Workspace } from '../types/preload'
import './App.css'

type AppView = 'mail' | 'calendar' | 'workspace'

function AppContent() {
  const dispatch = useAppDispatch()
  const { currentWorkspaceId } = useAppSelector(state => state.workspace)
  const theme = useAppSelector(state => state.theme)
  
  const [activeView, setActiveView] = useState<AppView>('mail')
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState('')
  
  // Use currentWorkspaceId from Redux instead of local state
  const activeWorkspaceId = currentWorkspaceId || ''
  
  // Memoize workspaces data to prevent unnecessary re-renders
  const workspaces = useAppSelector(state => {
    const workspaceValues = Object.values(state.workspace?.workspaces || {})
    console.log('Workspaces from Redux:', {
      workspaceCount: workspaceValues.length,
      workspaces: workspaceValues.map(w => ({ id: w.id, name: w.name }))
    })
    // Convert ISO strings back to Date objects for compatibility with Workspace interface
    return workspaceValues.map(workspace => ({
      ...workspace,
      created: new Date(workspace.created),
      lastAccessed: new Date(workspace.lastAccessed)
    }))
  }, (left, right) => JSON.stringify(left) === JSON.stringify(right)) as Workspace[]
  
  const currentWorkspace = useMemo(() => {
    const workspace = workspaces.find(w => w.id === activeWorkspaceId)
    console.log('Current workspace lookup:', {
      activeWorkspaceId,
      workspacesCount: workspaces.length,
      workspace: workspace,
      workspaceName: workspace?.name
    })
    return workspace
  }, [workspaces, activeWorkspaceId])
  
  const [activeServiceId, setActiveServiceId] = useState<string | undefined>()
  const [showSearchOverlay, setShowSearchOverlay] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAddServiceModal, setShowAddServiceModal] = useState(false)
  const [showEditServiceModal, setShowEditServiceModal] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [showAccessibilitySettings, setShowAccessibilitySettings] = useState(false)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)

  // BrowserView visibility management for proper z-index layering
  useBlockingOverlay('search-overlay', showSearchOverlay, 'SEARCH_OVERLAY')
  useBlockingOverlay('add-service-modal', showAddServiceModal, 'MODAL')
  useBlockingOverlay('edit-service-modal', showEditServiceModal, 'MODAL')
  useBlockingOverlay('accessibility-settings', showAccessibilitySettings, 'ACCESSIBILITY_OVERLAY')
  useBlockingOverlay('global-loading', globalLoading, 'LOADING_OVERLAY')

  // Global search functionality
  const handleGlobalSearch = useCallback(async (query: string, filters: SearchFilters): Promise<SearchResult[]> => {
    setGlobalLoading(true)
    setGlobalLoadingMessage('Searching...')
    
    try {
      // Implement global search across all data types
      const results: SearchResult[] = []
      
      // This would be replaced with actual search implementation
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call
      
      return results
    } catch (error) {
      console.error('Global search error:', error)
      throw error
    } finally {
      setGlobalLoading(false)
    }
  }, [])

  const handleSearchResultSelect = useCallback((result: SearchResult) => {
    // Navigate to the appropriate view based on result type
    switch (result.type) {
      case 'email':
        setActiveView('mail')
        // TODO: Navigate to specific email
        break
      case 'calendar':
        setActiveView('calendar')
        // TODO: Navigate to specific event
        break
      case 'contact':
        // TODO: Open contact view
        break
      case 'file':
        // TODO: Open file
        break
    }
    setShowSearchOverlay(false)
  }, [])

  // Enhanced keyboard shortcuts
  const shortcuts = useKeyboardShortcuts([
    {
      ...commonShortcuts.globalSearch,
      action: () => setShowSearchOverlay(true)
    },
    {
      ...commonShortcuts.goToMail,
      action: () => setActiveView('mail')
    },
    {
      ...commonShortcuts.goToCalendar,
      action: () => setActiveView('calendar')
    },
    {
      ...commonShortcuts.goToWorkspace,
      action: () => setActiveView('workspace')
    },
    {
      ...commonShortcuts.settings,
      action: () => setShowAccessibilitySettings(true)
    },
    {
      ...commonShortcuts.refresh,
      action: () => {
        setGlobalLoading(true)
        setGlobalLoadingMessage('Refreshing...')
        // Refresh current view data
        setTimeout(() => {
          setGlobalLoading(false)
          window.location.reload()
        }, 1000)
      }
    }
  ])

  // Memory management
  const memoryCleanup = useMemoryCleanup({
    maxItems: 500,
    cleanupInterval: 30000,
    enablePerfMonitoring: process.env.NODE_ENV === 'development'
  })

  // Performance monitoring
  const performanceMonitor = usePerformanceMonitor({
    componentName: 'App',
    enabled: __DEV__,
    logToConsole: __DEV__
  })
  
  // Monitor bundle loading in development
  useBundleMonitor()

  // Initialize theme and workspace data - wait for preload script
  useEffect(() => {
    const initializeApp = async () => {
      // Wait for preload script to load
      let retries = 0;
      while (!window.flowDesk && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (window.flowDesk) {
        console.log('Flow Desk API available, initializing app...');
        dispatch(loadThemeSettings());
        dispatch(loadWorkspaces());
      } else {
        console.error('Flow Desk API not available after waiting');
      }
    };
    
    initializeApp();
  }, [dispatch])

  // Apply theme when it changes
  useEffect(() => {
    dispatch(applyTheme())
  }, [theme, dispatch])

  // Auto-select first workspace when workspaces are loaded (now handled by Redux slice)
  // This useEffect is no longer needed since Redux slice handles this automatically

  const handleAddService = useCallback(async (serviceData: { name: string; type: string; url: string }) => {
    try {
      if (!activeWorkspaceId) {
        console.error('No active workspace selected');
        return;
      }

      const serviceId = await window.flowDesk.workspace.addService(
        activeWorkspaceId,
        serviceData.name,
        serviceData.type,
        serviceData.url
      );

      console.log('Added service:', serviceId, serviceData);
      
      // Refresh workspace data
      dispatch(loadWorkspaces());
    } catch (error) {
      console.error('Failed to add service:', error);
    }
  }, [activeWorkspaceId, dispatch]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      
      if (isMod) {
        switch (e.key) {
          case 'k':
            e.preventDefault()
            setShowSearchOverlay(true)
            break
          case '1':
            e.preventDefault()
            setActiveView('mail')
            break
          case '2':
            e.preventDefault()
            setActiveView('calendar')
            break
          case '3':
            e.preventDefault()
            setActiveView('workspace')
            break
          case ',':
            e.preventDefault()
            setShowAccessibilitySettings(true)
            break
        }
      }
      
      if (e.key === 'Escape') {
        setShowSearchOverlay(false)
        setShowNotifications(false)
        setShowAccessibilitySettings(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const renderMainContent = useMemo(() => {
    switch (activeView) {
      case 'mail':
        return (
          <MailErrorBoundary>
            <Suspense fallback={<ComponentLoader name="Mail" />}>
              <MailLayout 
                className="h-full" 
                onAddAccount={() => {
                  console.log('🟢 App.tsx: Opening add account modal');
                  setShowAddAccountModal(true);
                }}
              />
            </Suspense>
          </MailErrorBoundary>
        )
      case 'calendar':
        return (
          <CalendarErrorBoundary>
            <Suspense fallback={<ComponentLoader name="Calendar" />}>
              <CalendarViews
                className="h-full"
                onEventClick={(event) => console.log('Event clicked:', event)}
                onCreateEvent={() => console.log('Create event')}
              />
            </Suspense>
          </CalendarErrorBoundary>
        )
      case 'workspace':
        if (activeServiceId) {
          // Show the selected service content - BrowserView will be overlaid here
          const selectedService = currentWorkspace?.services.find((s: any) => s.id === activeServiceId);
          return (
            <WorkspaceErrorBoundary>
              <div className="h-full bg-white">
                {/* This area will be covered by BrowserView */}
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🔄</div>
                    <p className="text-sm text-gray-600">
                      Loading {selectedService?.name || 'service'}...
                    </p>
                  </div>
                </div>
              </div>
            </WorkspaceErrorBoundary>
          )
        } else {
          // Show workspace dashboard
          return (
            <WorkspaceErrorBoundary>
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🗂️</div>
                  <h2 className="text-xl font-semibold mb-2">Workspace Dashboard</h2>
                  <p className="text-sm text-muted-foreground">
                    Select a service from the sidebar to get started
                  </p>
                </div>
              </div>
            </WorkspaceErrorBoundary>
          )
        }
      default:
        return (
          <MailErrorBoundary>
            <MailLayout className="h-full" />
          </MailErrorBoundary>
        )
    }
  }, [activeView, activeServiceId, currentWorkspace?.services])

  return (
    <KeyboardShortcutManager shortcuts={shortcuts}>
      <div className="h-screen flex overflow-hidden bg-background text-foreground">
        {/* Global Loading Overlay */}
        <LoadingOverlay 
          isVisible={globalLoading} 
          message={globalLoadingMessage}
        />

        {/* Skip Links for Screen Readers */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <a href="#navigation" className="skip-link">
          Skip to navigation
        </a>

        {/* Color Blindness Filters */}
        <ColorBlindnessFilters />

      {/* Primary Sidebar (Far Left) - Mail, Calendar, Workspaces */}
      <nav id="navigation" role="navigation" aria-label="Main navigation" className={getZIndexClass('NAVIGATION')}>
        <FlowDeskLeftRail
          onViewSelect={(view) => {
            setActiveView(view);
            // Notify main process about view change to handle BrowserView visibility
            window.flowDesk?.view?.switch(view);
          }}
          onWorkspaceSelect={(workspaceId) => {
            // Use Redux dispatch to switch workspace
            dispatch(switchWorkspace(workspaceId));
          }}
          activeView={activeView}
          activeWorkspaceId={activeWorkspaceId}
        />
      </nav>

      {/* Secondary Sidebar - Services for Selected Workspace */}
      {activeView === 'workspace' && (
        <div className={getZIndexClass('SIDEBAR')}>
          <ServicesSidebar
          workspaceId={activeWorkspaceId}
          workspaceName={currentWorkspace?.name || 'Workspace'}
          services={currentWorkspace?.services || []}
          activeServiceId={activeServiceId}
          onServiceSelect={(serviceId) => {
            setActiveServiceId(serviceId);
            // Load the service in browser view
            if (activeWorkspaceId) {
              window.flowDesk.workspace.loadService(activeWorkspaceId, serviceId)
                .then(() => console.log('Service loaded:', serviceId))
                .catch(error => console.error('Failed to load service:', error));
            }
          }}
          onAddService={() => setShowAddServiceModal(true)}
          onEditService={(serviceId) => {
            setEditingServiceId(serviceId);
            setShowEditServiceModal(true);
          }}
          onDeleteService={async (serviceId) => {
            try {
              if (activeWorkspaceId) {
                await window.flowDesk.workspace.removeService(activeWorkspaceId, serviceId);
                dispatch(loadWorkspaces());
              }
            } catch (error) {
              console.error('Failed to remove service:', error);
            }
          }}
          onEditWorkspace={(workspaceId) => {
            console.log('Edit workspace functionality to be implemented:', workspaceId);
          }}
          onWorkspaceSettings={(workspaceId) => {
            console.log('Workspace settings functionality to be implemented:', workspaceId);
          }}
        />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main App View */}
        <main id="main-content" className={cn("flex-1 overflow-hidden relative", getZIndexClass('MAIN_CONTENT'))} role="main" aria-label="Main application content">
          {renderMainContent}
          
          {/* Plugin Panels Overlay */}
          <PluginPanels
            className="absolute inset-0 pointer-events-none"
            dockedPanelWidth={280}
            onPluginClose={(id) => console.log('Close plugin:', id)}
            onPluginSettings={(id) => console.log('Plugin settings:', id)}
          />
        </main>
      </div>

      {/* Advanced Search Overlay */}
      {showSearchOverlay && (
        <div 
          className={cn("fixed inset-0 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-20", getZIndexClass('SEARCH_OVERLAY'))}
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSearchOverlay(false)
            }
          }}
        >
          <div className="w-full max-w-3xl mx-4">
            <h2 id="search-title" className="sr-only">Global Search</h2>
            <AdvancedSearchInterface
              onSearch={handleGlobalSearch}
              onResultSelect={handleSearchResultSelect}
              autoFocus
              showFilters
              placeholder="Search mail, calendar, contacts, and files..."
            />
          </div>
        </div>
      )}

      {/* Notifications Overlay */}
      {showNotifications && (
        <aside 
          className={cn("fixed top-4 right-4 w-96", getZIndexClass('NOTIFICATIONS'))}
          role="complementary"
          aria-label="Notifications"
        >
          <NotificationsHub
            onNotificationAction={(id, action) => {
              console.log('Notification action:', id)
              action()
            }}
            onNotificationDismiss={(id) => console.log('Dismiss notification:', id)}
          />
        </aside>
      )}

      {/* Accessibility Settings Overlay */}
      {showAccessibilitySettings && (
        <div 
          className={cn("fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4", getZIndexClass('ACCESSIBILITY_OVERLAY'))}
          role="dialog"
          aria-modal="true"
          aria-labelledby="accessibility-title"
        >
          <AccessibilitySettings
            isOpen={showAccessibilitySettings}
            onClose={() => setShowAccessibilitySettings(false)}
          />
        </div>
      )}

      {/* Add Service Modal */}
      <AddServiceModal
        isOpen={showAddServiceModal}
        onClose={() => setShowAddServiceModal(false)}
        onAddService={handleAddService}
      />

      {/* Add Account Modal */}
      <SimpleMailAccountModal
        isOpen={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSuccess={(account) => {
          console.log('✅ Mail account added successfully:', account);
          // TODO: dispatch(fetchMailAccounts()) when needed
          setShowAddAccountModal(false);
        }}
      />

      {/* Edit Service Modal */}
      <EditServiceModal
        isOpen={showEditServiceModal}
        onClose={() => {
          setShowEditServiceModal(false);
          setEditingServiceId(null);
        }}
        workspaceId={currentWorkspace?.id || ''}
        serviceId={editingServiceId}
        currentService={currentWorkspace?.services.find((s: any) => s.id === editingServiceId)}
        onSave={async (serviceId, updates) => {
          try {
            console.log('Service updated successfully:', serviceId, updates);
            // Refresh the workspaces to show the updated service
            dispatch(loadWorkspaces());
          } catch (error) {
            console.error('Failed to update service:', error);
          }
        }}
      />

      {/* Global Notification System */}
      <NotificationContainer position="top-right" />
    </div>
    </KeyboardShortcutManager>
  )
}

function App() {
  return (
    <Provider store={store}>
      <AccessibilityProvider>
        <AppContent />
      </AccessibilityProvider>
    </Provider>
  )
}

export default App
