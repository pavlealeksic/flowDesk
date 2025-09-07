/**
 * @fileoverview Main Application Component - Flow Desk Desktop
 * 
 * This is the root component of Flow Desk's React application. It manages the overall
 * application layout, state initialization, and coordinates between different UI sections.
 * 
 * Key responsibilities:
 * - Application initialization and theme loading
 * - Global state management coordination
 * - Layout management (sidebars, main content area)
 * - Browser view visibility control
 * - Keyboard shortcut handling
 * - Performance monitoring and memory cleanup
 * 
 * Architecture:
 * - Uses Redux for state management
 * - Implements lazy loading for performance
 * - Manages browser view overlays for proper z-indexing
 * - Provides accessibility features and keyboard navigation
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, memo } from 'react'
import { Provider } from 'react-redux'
import { store } from './store'
import { useAppDispatch, useAppSelector } from './store'
import { loadThemeSettings, applyTheme } from './store/slices/themeSlice'
import { loadWorkspaces, switchWorkspace } from './store/slices/workspaceSlice'
import { useLogger } from './logging/RendererLoggingService'
import {
  PluginPanels,
  NotificationsHub,
  cn,
  Loader2,
  Button
} from './components'
import { AccessibilityProvider } from './contexts/AccessibilityContext'
import ColorBlindnessFilters from './components/accessibility/ColorBlindnessFilters'
import { NotificationContainer } from './components/ui/NotificationSystem'
import { WorkspaceErrorBoundary } from './components/ui/ErrorBoundary'
import { KeyboardShortcutManager, commonShortcuts, useKeyboardShortcuts } from './components/ui/KeyboardShortcuts'
import { LoadingOverlay } from './components/ui/LoadingStates'
import type { SearchResult, SearchFilters } from './components/search/AdvancedSearchInterface'
import { getZIndexClass } from './constants/zIndex'
import { useBlockingOverlay } from './hooks/useBrowserViewVisibility'

// Lazy load heavy components for better initial load performance
const AdvancedSearchInterface = lazy(() => 
  import('./components/search/AdvancedSearchInterface').then(module => ({ 
    default: module.AdvancedSearchInterface 
  }))
)
const AccessibilitySettings = lazy(() => import('./components/accessibility/AccessibilitySettings'))
const AddServiceModal = lazy(() => import('./components/workspace/AddServiceModal'))
const EditServiceModal = lazy(() => import('./components/workspace/EditServiceModal'))

// Loading fallback component - Memoized to prevent unnecessary re-renders
const ComponentLoader: React.FC<{ name: string }> = memo(({ name }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center">
      <div className="text-2xl mb-2">⏳</div>
      <p className="text-sm text-muted-foreground">Loading {name}...</p>
    </div>
  </div>
))
import FlowDeskLeftRail from './components/layout/FlowDeskLeftRail'
import ServicesSidebar from './components/layout/ServicesSidebar'
import ReactProfilerWrapper from './components/performance/ReactProfilerWrapper'
import { useMemoryCleanup } from './hooks/useMemoryCleanup'
import { usePerformanceMonitor, useBundleMonitor } from './hooks/usePerformanceMonitor'
import { handleError, classifyError, type AppError, workspaceErrors, serviceErrors } from './utils/errorHandler'
import { ToastSystem, useToast } from './components/ui/ToastSystem'
import type { Workspace } from '../types/preload'
import './App.css'

type AppView = 'workspace'

/**
 * Main application content component that manages the core UI and application state
 * 
 * This component handles:
 * - Workspace state management and synchronization
 * - Theme application and updates
 * - Global loading states and overlays
 * - Service selection and browser view management
 * - Keyboard shortcuts and accessibility
 * - Performance monitoring and memory cleanup
 * 
 * @component
 * @returns {JSX.Element} The main application interface
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <Provider store={store}>
 *       <AppContent />
 *     </Provider>
 *   );
 * }
 * ```
 */
function AppContent() {
  const dispatch = useAppDispatch()
  const { currentWorkspaceId } = useAppSelector(state => state.workspace)
  const theme = useAppSelector(state => state.theme)
  const logger = useLogger('App')
  const toast = useToast()
  
  const [activeView, setActiveView] = useState<AppView>('workspace')
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState('')
  const [currentError, setCurrentError] = useState<AppError | null>(null)
  
  // Use currentWorkspaceId from Redux instead of local state
  const activeWorkspaceId = currentWorkspaceId || ''
  
  // Optimized workspaces selector with shallow equality check
  const workspaces = useAppSelector(state => {
    const workspaceValues = Object.values(state.workspace?.workspaces || {})
    // Convert ISO strings back to Date objects for compatibility with Workspace interface
    return workspaceValues.map(workspace => ({
      ...workspace,
      created: new Date(workspace.created),
      lastAccessed: new Date(workspace.lastAccessed)
    }))
  }) as Workspace[]

  // Memoize workspaces to prevent unnecessary re-renders on the same data
  const memoizedWorkspaces = useMemo(() => {
    logger.debug('Workspaces memoized', undefined, {
      workspaceCount: workspaces.length,
      workspaces: workspaces.map(w => ({ id: w.id, name: w.name }))
    })
    return workspaces
  }, [workspaces.length, JSON.stringify(workspaces.map(w => ({ id: w.id, name: w.name, created: w.created.getTime() })))])
  
  const currentWorkspace = useMemo(() => {
    const workspace = memoizedWorkspaces.find(w => w.id === activeWorkspaceId)
    logger.debug('Current workspace lookup', { activeWorkspaceId }, {
      workspacesCount: memoizedWorkspaces.length,
      hasWorkspace: Boolean(workspace),
      workspaceName: workspace?.name
    })
    return workspace
  }, [memoizedWorkspaces, activeWorkspaceId])
  
  const [activeServiceId, setActiveServiceId] = useState<string | undefined>()
  const [showSearchOverlay, setShowSearchOverlay] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAddServiceModal, setShowAddServiceModal] = useState(false)
  const [showEditServiceModal, setShowEditServiceModal] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [showAccessibilitySettings, setShowAccessibilitySettings] = useState(false)

  // WebContentsView visibility management for proper z-index layering
  useBlockingOverlay('search-overlay', showSearchOverlay, 'SEARCH_OVERLAY')
  useBlockingOverlay('add-service-modal', showAddServiceModal, 'MODAL')
  useBlockingOverlay('edit-service-modal', showEditServiceModal, 'MODAL')
  useBlockingOverlay('accessibility-settings', showAccessibilitySettings, 'ACCESSIBILITY_OVERLAY')
  useBlockingOverlay('global-loading', globalLoading, 'LOADING_OVERLAY')
  useBlockingOverlay('error-dialog', !!currentError, 'ERROR_OVERLAY')

  // Memoize overlay state calculation
  const hasOverlayVisible = useMemo(() => {
    return showSearchOverlay || showAddServiceModal || showEditServiceModal || showAccessibilitySettings || globalLoading || showNotifications || !!currentError
  }, [showSearchOverlay, showAddServiceModal, showEditServiceModal, showAccessibilitySettings, globalLoading, showNotifications, currentError])

  // Hide web contents view when any overlay is shown
  useEffect(() => {
    if (hasOverlayVisible) {
      window.flowDesk?.browserView?.hide?.()
    } else {
      window.flowDesk?.browserView?.show?.()
    }
  }, [hasOverlayVisible])

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

  // Memory management - side effect hooks
  useMemoryCleanup({
    maxItems: 500,
    cleanupInterval: 30000,
    enablePerfMonitoring: process.env.NODE_ENV === 'development'
  })

  // Performance monitoring - side effect hook
  usePerformanceMonitor({
    componentName: 'App',
    enabled: process.env.NODE_ENV === 'development',
    logToConsole: process.env.NODE_ENV === 'development'
  })
  
  // Monitor bundle loading in development
  useBundleMonitor()

  // Initialize theme and workspace data - wait for preload script
  useEffect(() => {
    const initializeApp = async () => {
      setGlobalLoading(true);
      setGlobalLoadingMessage('Initializing application...');
      
      try {
        // Wait for preload script to load
        let retries = 0;
        while (!window.flowDesk && retries < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
        
        if (window.flowDesk) {
          console.log('Flow Desk API available, initializing app...');
          dispatch(loadThemeSettings());
          
          // Load workspaces with error handling
          try {
            await dispatch(loadWorkspaces()).unwrap();
          } catch (error) {
            const appError = await handleError(error, {
              operation: 'Load workspaces',
              component: 'App',
              onRetry: () => {
                setCurrentError(null);
                dispatch(loadWorkspaces());
              },
              onDismiss: () => setCurrentError(null)
            });
            setCurrentError(appError);
          }
        } else {
          const appError = workspaceErrors.loadFailed('Application failed to initialize properly');
          appError.recoveryActions = [
            {
              label: 'Restart App',
              action: () => window.location.reload(),
              primary: true
            },
            {
              label: 'Dismiss',
              action: () => setCurrentError(null)
            }
          ];
          setCurrentError(appError);
        }
      } finally {
        setGlobalLoading(false);
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
        const error = workspaceErrors.notFound('No workspace selected');
        error.recoveryActions = [
          {
            label: 'Select Workspace',
            action: () => setCurrentError(null)
          }
        ];
        setCurrentError(error);
        return;
      }

      setGlobalLoading(true);
      setGlobalLoadingMessage(`Adding ${serviceData.name}...`);

      const serviceId = await window.flowDesk.workspace.addService(
        activeWorkspaceId,
        serviceData.name,
        serviceData.type,
        serviceData.url
      );

      console.log('Added service:', serviceId, serviceData);
      
      // Show success toast
      toast.showSuccess(
        'Service Added',
        `${serviceData.name} has been added to your workspace`
      );
      
      // Refresh workspace data
      await dispatch(loadWorkspaces()).unwrap();
      
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'Add service',
        component: 'App',
        onRetry: () => {
          setCurrentError(null);
          handleAddService(serviceData);
        },
        onDismiss: () => setCurrentError(null)
      });
      
      // Classify as service error if it's an IPC error
      if (appError.code === 'UNKNOWN_ERROR' && error && typeof error === 'object' && 'isIpcError' in error) {
        const ipcError = error as any;
        const serviceError = serviceErrors.creationFailed(serviceData.name, serviceData.url, ipcError.userMessage);
        serviceError.recoveryActions = appError.recoveryActions;
        setCurrentError(serviceError);
      } else {
        setCurrentError(appError);
      }
    } finally {
      setGlobalLoading(false);
    }
  }, [activeWorkspaceId, dispatch]);

  // Memoized keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey
    
    if (isMod) {
      switch (e.key) {
        case 'k':
          e.preventDefault()
          setShowSearchOverlay(true)
          break
        case '1':
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
      setCurrentError(null)
    }
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { passive: false })
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const renderMainContent = useMemo(() => {
    switch (activeView) {
      case 'workspace':
        if (activeServiceId) {
          // Show the selected service content - WebContentsView will be overlaid here
          const selectedService = currentWorkspace?.services.find((s: any) => s.id === activeServiceId);
          return (
            <WorkspaceErrorBoundary>
              <div className="h-full bg-white">
                {/* This area will be covered by WebContentsView */}
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Loading Service</h3>
                    <p className="text-sm text-muted-foreground">
                      Starting {selectedService?.name || 'service'}...
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
  }, [activeView, activeServiceId, currentWorkspace?.services])

  return (
    <KeyboardShortcutManager shortcuts={shortcuts}>
      <div className="h-screen w-full flex overflow-hidden bg-background text-foreground">
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

      {/* Main Content Area - Flex Layout with fixed sidebar widths */}
      <div className="h-full flex overflow-hidden">
        {/* Primary Sidebar (Far Left) - Workspaces - Fixed width w-16 */}
        <nav id="navigation" role="navigation" aria-label="Main navigation" className={cn("w-16 flex-shrink-0", getZIndexClass('NAVIGATION'))}>
          <ReactProfilerWrapper id="FlowDeskLeftRail">
            <FlowDeskLeftRail
              onWorkspaceSelect={useCallback((workspaceId: string) => {
                // Use Redux dispatch to switch workspace
                dispatch(switchWorkspace(workspaceId));
              }, [dispatch])}
              activeWorkspaceId={activeWorkspaceId}
            />
          </ReactProfilerWrapper>
        </nav>

        {/* Secondary Sidebar - Services for Selected Workspace - Fixed width w-64 */}
        <div className={cn("w-64 flex-shrink-0", getZIndexClass('SIDEBAR'))}>
          <ReactProfilerWrapper id="ServicesSidebar">
            <ServicesSidebar
            workspaceId={activeWorkspaceId}
            workspaceName={currentWorkspace?.name || 'Workspace'}
            services={currentWorkspace?.services || []}
            activeServiceId={activeServiceId}
            onServiceSelect={useCallback(async (serviceId: string) => {
              setActiveServiceId(serviceId);
              // Load the service in browser view
              if (activeWorkspaceId) {
                try {
                  setGlobalLoading(true);
                  setGlobalLoadingMessage('Loading service...');
                  
                  await window.flowDesk.workspace.loadService(activeWorkspaceId, serviceId);
                  console.log('Service loaded:', serviceId);
                  
                  // Show success toast
                  const service = currentWorkspace?.services.find(s => s.id === serviceId);
                  if (service) {
                    toast.showSuccess('Service Loaded', `${service.name} is now ready to use`);
                  }
                } catch (error) {
                  const service = currentWorkspace?.services.find(s => s.id === serviceId);
                  const serviceName = service?.name || 'service';
                  
                  const appError = await handleError(error, {
                    operation: 'Load service',
                    component: 'App',
                    onRetry: async () => {
                      setCurrentError(null);
                      try {
                        await window.flowDesk.workspace.loadService(activeWorkspaceId, serviceId);
                      } catch (retryError) {
                        console.error('Retry failed:', retryError);
                      }
                    },
                    onDismiss: () => setCurrentError(null)
                  });
                  
                  // Classify as service error if it's an IPC error
                  if (error && typeof error === 'object' && 'isIpcError' in error) {
                    const ipcError = error as any;
                    const serviceError = serviceErrors.loadFailed(serviceName, ipcError.userMessage);
                    serviceError.recoveryActions = appError.recoveryActions;
                    setCurrentError(serviceError);
                  } else {
                    setCurrentError(appError);
                  }
                } finally {
                  setGlobalLoading(false);
                }
              }
            }, [activeWorkspaceId, currentWorkspace])}
            onAddService={useCallback(() => setShowAddServiceModal(true), [])}
            onEditService={useCallback((serviceId: string) => {
              setEditingServiceId(serviceId);
              setShowEditServiceModal(true);
            }, [])}
            onDeleteService={useCallback(async (serviceId: string) => {
              if (!activeWorkspaceId) return;
              
              const service = currentWorkspace?.services.find(s => s.id === serviceId);
              const serviceName = service?.name || 'service';
              
              try {
                setGlobalLoading(true);
                setGlobalLoadingMessage(`Removing ${serviceName}...`);
                
                await window.flowDesk.workspace.removeService(activeWorkspaceId, serviceId);
                await dispatch(loadWorkspaces()).unwrap();
                
                // Show success toast
                toast.showSuccess('Service Removed', `${serviceName} has been removed from your workspace`);
                
                // Clear active service if it was deleted
                if (activeServiceId === serviceId) {
                  setActiveServiceId(undefined);
                }
              } catch (error) {
                const appError = await handleError(error, {
                  operation: 'Remove service',
                  component: 'App',
                  onRetry: async () => {
                    setCurrentError(null);
                    try {
                      await window.flowDesk.workspace.removeService(activeWorkspaceId, serviceId);
                      await dispatch(loadWorkspaces()).unwrap();
                    } catch (retryError) {
                      console.error('Retry failed:', retryError);
                    }
                  },
                  onDismiss: () => setCurrentError(null)
                });
                
                // Classify as service error if it's an IPC error
                if (error && typeof error === 'object' && 'isIpcError' in error) {
                  const ipcError = error as any;
                  const serviceError = serviceErrors.deleteFailed(serviceName, ipcError.userMessage);
                  serviceError.recoveryActions = appError.recoveryActions;
                  setCurrentError(serviceError);
                } else {
                  setCurrentError(appError);
                }
              } finally {
                setGlobalLoading(false);
              }
            }, [activeWorkspaceId, currentWorkspace, activeServiceId, dispatch])}
            onRetryService={useCallback(async (serviceId: string) => {
              if (!activeWorkspaceId) return;
              
              const service = currentWorkspace?.services.find(s => s.id === serviceId);
              const serviceName = service?.name || 'service';
              
              try {
                setGlobalLoading(true);
                setGlobalLoadingMessage(`Retrying ${serviceName}...`);
                
                await window.flowDesk.workspace.loadService(activeWorkspaceId, serviceId);
                
                // Show success toast
                toast.showSuccess('Service Retried', `${serviceName} connection has been restored`);
                
                console.log('Service retry successful:', serviceId);
              } catch (error) {
                // Show error toast for retry failures (less intrusive than modal)
                toast.showError(
                  'Retry Failed',
                  `Failed to reconnect to ${serviceName}. Please try again later.`
                );
                
                console.error('Service retry failed:', error);
              } finally {
                setGlobalLoading(false);
              }
            }, [activeWorkspaceId, currentWorkspace, toast])}
            onEditWorkspace={useCallback((workspaceId: string) => {
              console.log('Edit workspace functionality to be implemented:', workspaceId);
            }, [])}
            onWorkspaceSettings={useCallback((workspaceId: string) => {
              console.log('Workspace settings functionality to be implemented:', workspaceId);
            }, [])}
            />
          </ReactProfilerWrapper>
        </div>

        {/* Main Content Area - Takes remaining space */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Main App View */}
          <main id="main-content" className={cn("flex-1 overflow-hidden relative bg-background", getZIndexClass('MAIN_CONTENT'))} role="main" aria-label="Main application content">
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
      </div>

      {/* Advanced Search Overlay */}
      {showSearchOverlay && (
        <div 
          className={cn("fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center", getZIndexClass('SEARCH_OVERLAY'))}
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-title"
          onClick={useCallback((e: React.MouseEvent) => {
            if (e.target === e.currentTarget) {
              setShowSearchOverlay(false)
            }
          }, [])}
        >
          <div className="w-full max-w-3xl mx-4">
            <h2 id="search-title" className="sr-only">Global Search</h2>
            <Suspense fallback={<ComponentLoader name="Search" />}>
              <AdvancedSearchInterface
                onSearch={handleGlobalSearch}
                onResultSelect={handleSearchResultSelect}
                autoFocus
                showFilters
                placeholder="Search contacts and files..."
              />
            </Suspense>
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
          <Suspense fallback={<ComponentLoader name="Accessibility Settings" />}>
            <AccessibilitySettings
              isOpen={showAccessibilitySettings}
              onClose={() => setShowAccessibilitySettings(false)}
            />
          </Suspense>
        </div>
      )}

      {/* Add Service Modal */}
      <Suspense fallback={<ComponentLoader name="Add Service Modal" />}>
        <AddServiceModal
          isOpen={showAddServiceModal}
          onClose={useCallback(() => setShowAddServiceModal(false), [])}
          onAddService={handleAddService}
        />
      </Suspense>

      {/* Edit Service Modal */}
      <Suspense fallback={<ComponentLoader name="Edit Service Modal" />}>
        <EditServiceModal
          isOpen={showEditServiceModal}
          onClose={useCallback(() => {
            setShowEditServiceModal(false);
            setEditingServiceId(null);
          }, [])}
          workspaceId={currentWorkspace?.id || ''}
          serviceId={editingServiceId}
          currentService={currentWorkspace?.services.find((s: any) => s.id === editingServiceId)}
          onSave={useCallback(async (serviceId: string, updates: any) => {
            try {
              console.log('Service updated successfully:', serviceId, updates);
              // Refresh the workspaces to show the updated service
              dispatch(loadWorkspaces());
            } catch (error) {
              console.error('Failed to update service:', error);
            }
          }, [dispatch])}
        />
      </Suspense>

      {/* Error Dialog */}
      {currentError && (
        <div 
          className={cn("fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4", getZIndexClass('ERROR_OVERLAY'))}
          role="dialog"
          aria-modal="true"
          aria-labelledby="error-title"
        >
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              {/* Error Icon and Title */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                    <span className="text-destructive text-lg">⚠️</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 id="error-title" className="text-lg font-semibold text-foreground">
                    {(() => {
                      const errorMessages = {
                        WORKSPACE_NOT_FOUND: 'Workspace Not Found',
                        WORKSPACE_CREATION_FAILED: 'Failed to Create Workspace',
                        WORKSPACE_LOAD_FAILED: 'Failed to Load Workspaces',
                        SERVICE_CREATION_FAILED: 'Failed to Add Service',
                        SERVICE_LOAD_FAILED: 'Service Failed to Load',
                        SERVICE_DELETE_FAILED: 'Failed to Remove Service',
                        UNKNOWN_ERROR: 'Something Went Wrong'
                      };
                      return errorMessages[currentError.code as keyof typeof errorMessages] || 'Error';
                    })()}
                  </h2>
                </div>
              </div>

              {/* Error Message */}
              <p className="text-sm text-muted-foreground mb-4">
                {currentError.userMessage}
              </p>

              {/* Error Details (expandable) */}
              {currentError.details && (
                <details className="mb-4">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Technical Details
                  </summary>
                  <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted p-2 rounded">
                    {currentError.details}
                  </p>
                </details>
              )}

              {/* Recovery Actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-2">
                {currentError.recoveryActions?.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.primary ? 'default' : 'outline'}
                    size="sm"
                    onClick={action.action}
                    className="w-full sm:w-auto"
                  >
                    {action.label}
                  </Button>
                )) || (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentError(null)}
                    className="w-full sm:w-auto"
                  >
                    Dismiss
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification System */}
      <ToastSystem position="top-right" maxToasts={3} />

      {/* Global Notification System */}
      <NotificationContainer position="top-right" />
      
      </div> {/* Close main content area */}
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
