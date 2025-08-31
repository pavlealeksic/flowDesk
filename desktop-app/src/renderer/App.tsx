import React, { useState, useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from './store'
import { useAppDispatch, useAppSelector } from './store'
import { loadThemeSettings, applyTheme } from './store/slices/themeSlice'
import { loadWorkspaces } from './store/slices/workspaceSlice'
import {
  MailLayout,
  CalendarViews,
  PluginPanels,
  NotificationsHub,
  SearchInterface,
  SettingsPanels,
  cn
} from './components'
import FlowDeskLeftRail from './components/layout/FlowDeskLeftRail'
import ServicesSidebar from './components/layout/ServicesSidebar'
import AddServiceModal from './components/workspace/AddServiceModal'
import EditServiceModal from './components/workspace/EditServiceModal'
import './App.css'

type AppView = 'mail' | 'calendar' | 'workspace'

function AppContent() {
  const dispatch = useAppDispatch()
  const { currentWorkspaceId } = useAppSelector(state => state.workspace)
  const theme = useAppSelector(state => state.theme)
  
  const [activeView, setActiveView] = useState<AppView>('mail')
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('')
  
  // Get workspaces data for ServicesSidebar (after state is initialized)
  const workspaces = useAppSelector(state => 
    Object.values(state.workspace?.workspaces || {})
  ) as any[]
  const currentWorkspace = workspaces.find(w => w.id === activeWorkspaceId)
  const [activeServiceId, setActiveServiceId] = useState<string | undefined>()
  const [showSearchOverlay, setShowSearchOverlay] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAddServiceModal, setShowAddServiceModal] = useState(false)
  const [showEditServiceModal, setShowEditServiceModal] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)

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
  }, [])

  // Apply theme when it changes
  useEffect(() => {
    dispatch(applyTheme())
  }, [theme, dispatch])

  const handleAddService = async (serviceData: { name: string; type: string; url: string }) => {
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
  };

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
        }
      }
      
      if (e.key === 'Escape') {
        setShowSearchOverlay(false)
        setShowNotifications(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const renderMainContent = () => {
    switch (activeView) {
      case 'mail':
        return <MailLayout className="h-full" />
      case 'calendar':
        return (
          <CalendarViews
            className="h-full"
            onEventClick={(event) => console.log('Event clicked:', event)}
            onCreateEvent={() => console.log('Create event')}
          />
        )
      case 'workspace':
        if (activeServiceId) {
          // Show the selected service content - BrowserView will be overlaid here
          const selectedService = currentWorkspace?.services.find(s => s.id === activeServiceId);
          return (
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
          )
        } else {
          // Show workspace dashboard
          return (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🗂️</div>
                <h2 className="text-xl font-semibold mb-2">Workspace Dashboard</h2>
                <p className="text-sm text-muted-foreground">
                  Select a service from the sidebar to get started
                </p>
              </div>
            </div>
          )
        }
      default:
        return <MailLayout className="h-full" />
    }
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground">
      {/* Primary Sidebar (Far Left) - Mail, Calendar, Workspaces */}
      <FlowDeskLeftRail
        onViewSelect={setActiveView}
        onWorkspaceSelect={setActiveWorkspaceId}
        activeView={activeView}
        activeWorkspaceId={activeWorkspaceId}
      />

      {/* Secondary Sidebar - Services for Selected Workspace */}
      {activeView === 'workspace' && (
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
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main App View */}
        <div className="flex-1 overflow-hidden relative">
          {renderMainContent()}
          
          {/* Plugin Panels Overlay */}
          <PluginPanels
            className="absolute inset-0 pointer-events-none"
            dockedPanelWidth={280}
            onPluginClose={(id) => console.log('Close plugin:', id)}
            onPluginSettings={(id) => console.log('Plugin settings:', id)}
          />
        </div>
      </div>

      {/* Search Overlay */}
      {showSearchOverlay && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-20">
          <div className="w-full max-w-2xl mx-4">
            <SearchInterface
              autoFocus
              onResultSelect={(result) => {
                console.log('Selected result:', result)
                setShowSearchOverlay(false)
                // Navigate to result
              }}
            />
          </div>
        </div>
      )}

      {/* Notifications Overlay */}
      {showNotifications && (
        <div className="fixed top-4 right-4 z-50 w-96">
          <NotificationsHub
            onNotificationAction={(id, action) => {
              console.log('Notification action:', id)
              action()
            }}
            onNotificationDismiss={(id) => console.log('Dismiss notification:', id)}
          />
        </div>
      )}

      {/* Add Service Modal */}
      <AddServiceModal
        isOpen={showAddServiceModal}
        onClose={() => setShowAddServiceModal(false)}
        onAddService={handleAddService}
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
        currentService={currentWorkspace?.services.find(s => s.id === editingServiceId)}
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
    </div>
  )
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  )
}

export default App
