/**
 * Comprehensive unit tests for App.tsx
 * Tests main application component, workspace management, and UI interactions
 */

import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from '../../renderer/App';
import { workspaceSlice } from '../../renderer/store/slices/workspaceSlice';
import { themeSlice } from '../../renderer/store/slices/themeSlice';
import { searchSlice } from '../../renderer/store/slices/searchSlice';

// Mock the heavy components that are lazily loaded
vi.mock('../../renderer/components/search/AdvancedSearchInterface', () => ({
  AdvancedSearchInterface: vi.fn(() => <div data-testid="advanced-search">Advanced Search</div>)
}));

vi.mock('../../renderer/components/accessibility/AccessibilitySettings', () => ({
  default: vi.fn(() => <div data-testid="accessibility-settings">Accessibility Settings</div>)
}));

vi.mock('../../renderer/components/workspace/AddServiceModal', () => ({
  default: vi.fn(({ isOpen, onAddService, onClose }) => 
    isOpen ? (
      <div data-testid="add-service-modal">
        <button onClick={() => onAddService({ name: 'Test Service', type: 'web', url: 'https://test.com' })}>
          Add Service
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  )
}));

vi.mock('../../renderer/components/workspace/EditServiceModal', () => ({
  default: vi.fn(({ isOpen, onClose, onSave }) => 
    isOpen ? (
      <div data-testid="edit-service-modal">
        <button onClick={() => onSave('service-1', { name: 'Updated Service' })}>
          Save
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  )
}));

// Mock the layout components
vi.mock('../../renderer/components/layout/FlowDeskLeftRail', () => ({
  default: vi.fn(({ onWorkspaceSelect, activeWorkspaceId }) => (
    <div data-testid="left-rail">
      <button onClick={() => onWorkspaceSelect('workspace-1')}>
        Workspace 1 {activeWorkspaceId === 'workspace-1' && '(Active)'}
      </button>
      <button onClick={() => onWorkspaceSelect('workspace-2')}>
        Workspace 2 {activeWorkspaceId === 'workspace-2' && '(Active)'}
      </button>
    </div>
  ))
}));

vi.mock('../../renderer/components/layout/ServicesSidebar', () => ({
  default: vi.fn(({ 
    workspaceId, 
    workspaceName, 
    services, 
    activeServiceId,
    onServiceSelect,
    onAddService,
    onEditService,
    onDeleteService 
  }) => (
    <div data-testid="services-sidebar">
      <h2>{workspaceName}</h2>
      <button onClick={onAddService}>Add Service</button>
      {services.map((service: any) => (
        <div key={service.id} data-testid={`service-${service.id}`}>
          <button onClick={() => onServiceSelect(service.id)}>
            {service.name} {activeServiceId === service.id && '(Active)'}
          </button>
          <button onClick={() => onEditService(service.id)}>Edit</button>
          <button onClick={() => onDeleteService(service.id)}>Delete</button>
        </div>
      ))}
    </div>
  ))
}));

// Mock other components
vi.mock('../../renderer/components', () => ({
  PluginPanels: vi.fn(() => <div data-testid="plugin-panels">Plugin Panels</div>),
  NotificationsHub: vi.fn(() => <div data-testid="notifications-hub">Notifications</div>),
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
  Loader2: vi.fn(() => <div data-testid="loader">Loading...</div>)
}));

vi.mock('../../renderer/contexts/AccessibilityContext', () => ({
  AccessibilityProvider: vi.fn(({ children }) => <div>{children}</div>)
}));

vi.mock('../../renderer/components/accessibility/ColorBlindnessFilters', () => ({
  default: vi.fn(() => <div data-testid="color-blindness-filters">Color Filters</div>)
}));

vi.mock('../../renderer/components/ui/NotificationSystem', () => ({
  NotificationContainer: vi.fn(() => <div data-testid="notification-container">Notifications</div>)
}));

vi.mock('../../renderer/components/ui/ErrorBoundary', () => ({
  WorkspaceErrorBoundary: vi.fn(({ children }) => <div data-testid="error-boundary">{children}</div>)
}));

vi.mock('../../renderer/components/ui/KeyboardShortcuts', () => ({
  KeyboardShortcutManager: vi.fn(({ children }) => <div>{children}</div>),
  useKeyboardShortcuts: vi.fn(() => []),
  commonShortcuts: {
    globalSearch: { key: 'k', ctrlKey: true, description: 'Global search' },
    goToWorkspace: { key: '1', ctrlKey: true, description: 'Go to workspace' },
    settings: { key: ',', ctrlKey: true, description: 'Settings' },
    refresh: { key: 'r', ctrlKey: true, description: 'Refresh' }
  }
}));

vi.mock('../../renderer/components/ui/LoadingStates', () => ({
  LoadingOverlay: vi.fn(({ isVisible, message }) => 
    isVisible ? <div data-testid="loading-overlay">{message}</div> : null
  )
}));

vi.mock('../../renderer/constants/zIndex', () => ({
  getZIndexClass: vi.fn((level: string) => `z-${level.toLowerCase()}`)
}));

vi.mock('../../renderer/hooks/useBrowserViewVisibility', () => ({
  useBlockingOverlay: vi.fn()
}));

vi.mock('../../renderer/hooks/useMemoryCleanup', () => ({
  useMemoryCleanup: vi.fn()
}));

vi.mock('../../renderer/hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: vi.fn(),
  useBundleMonitor: vi.fn()
}));

vi.mock('../../renderer/components/performance/ReactProfilerWrapper', () => ({
  default: vi.fn(({ children }) => <div>{children}</div>)
}));

vi.mock('../../renderer/logging/RendererLoggingService', () => ({
  useLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

describe('App Component', () => {
  let store: ReturnType<typeof configureStore>;
  let user: ReturnType<typeof userEvent.setup>;

  const createMockStore = (initialState = {}) => {
    return configureStore({
      reducer: {
        workspace: workspaceSlice.reducer,
        theme: themeSlice.reducer,
        search: searchSlice.reducer
      },
      preloadedState: {
        workspace: {
          workspaces: {
            'workspace-1': {
              id: 'workspace-1',
              name: 'Personal',
              abbreviation: 'PE',
              color: '#4285f4',
              browserIsolation: 'shared',
              services: [
                {
                  id: 'service-1',
                  name: 'Gmail',
                  type: 'email',
                  url: 'https://mail.google.com',
                  isEnabled: true,
                  config: {}
                }
              ],
              members: [],
              created: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
              isActive: true
            },
            'workspace-2': {
              id: 'workspace-2',
              name: 'Work',
              abbreviation: 'WO',
              color: '#34a853',
              browserIsolation: 'isolated',
              services: [],
              members: [],
              created: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
              isActive: false
            }
          },
          currentWorkspaceId: 'workspace-1',
          loading: false,
          error: null
        },
        theme: {
          mode: 'system',
          accentColor: '#007acc',
          fontSize: 14,
          highContrast: false,
          reducedMotion: false
        },
        search: {
          query: '',
          filters: {},
          results: [],
          loading: false,
          error: null
        },
        ...initialState
      }
    });
  };

  beforeEach(() => {
    // Setup user event
    user = userEvent.setup();
    
    // Create store
    store = createMockStore();

    // Reset all mocks
    vi.clearAllMocks();

    // Setup window.flowDesk mock
    Object.defineProperty(window, 'flowDesk', {
      value: {
        workspace: {
          create: vi.fn().mockResolvedValue('new-workspace-id'),
          list: vi.fn().mockResolvedValue([]),
          get: vi.fn().mockResolvedValue(null),
          delete: vi.fn().mockResolvedValue(undefined),
          addService: vi.fn().mockResolvedValue('new-service-id'),
          removeService: vi.fn().mockResolvedValue(undefined),
          loadService: vi.fn().mockResolvedValue(undefined),
          switch: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
          clearData: vi.fn().mockResolvedValue(undefined)
        },
        browserView: {
          hide: vi.fn(),
          show: vi.fn()
        },
        theme: {
          get: vi.fn().mockResolvedValue({ theme: 'system' }),
          set: vi.fn().mockResolvedValue(undefined)
        },
        system: {
          showNotification: vi.fn(),
          showDialog: vi.fn().mockResolvedValue({ response: 0 }),
          openExternal: vi.fn()
        }
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('should render main application structure', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      expect(screen.getByTestId('left-rail')).toBeInTheDocument();
      expect(screen.getByTestId('services-sidebar')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByTestId('color-blindness-filters')).toBeInTheDocument();
    });

    test('should render workspace dashboard when no service is selected', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      expect(screen.getByText('Workspace Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Select a service from the sidebar to get started')).toBeInTheDocument();
    });

    test('should show loading state when service is selected', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Click on a service
      const serviceButton = screen.getByText('Gmail');
      await user.click(serviceButton);

      await waitFor(() => {
        expect(screen.getByTestId('loader')).toBeInTheDocument();
        expect(screen.getByText('Loading Service')).toBeInTheDocument();
        expect(screen.getByText('Starting Gmail...')).toBeInTheDocument();
      });
    });

    test('should display current workspace name in services sidebar', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    test('should render services in sidebar', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      expect(screen.getByTestId('service-service-1')).toBeInTheDocument();
      expect(screen.getByText('Gmail')).toBeInTheDocument();
    });
  });

  describe('Workspace Management', () => {
    test('should switch workspace when clicking in left rail', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const workspace2Button = screen.getByText(/Workspace 2/);
      await user.click(workspace2Button);

      // Should update the workspace in the sidebar
      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });
    });

    test('should show active workspace indicator', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      expect(screen.getByText('Workspace 1 (Active)')).toBeInTheDocument();
      expect(screen.queryByText('Workspace 2 (Active)')).not.toBeInTheDocument();
    });

    test('should handle workspace switching errors', async () => {
      // Mock error in workspace switch
      window.flowDesk.workspace.switch = vi.fn().mockRejectedValue(new Error('Switch failed'));

      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const workspace2Button = screen.getByText(/Workspace 2/);
      await user.click(workspace2Button);

      // Should not crash and should log error
      expect(window.flowDesk.workspace.switch).toHaveBeenCalledWith('workspace-2');
    });
  });

  describe('Service Management', () => {
    test('should open add service modal when clicking add service', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const addServiceButton = screen.getByText('Add Service');
      await user.click(addServiceButton);

      expect(screen.getByTestId('add-service-modal')).toBeInTheDocument();
    });

    test('should add service through modal', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Open modal
      const addServiceButton = screen.getByText('Add Service');
      await user.click(addServiceButton);

      // Add service
      const addButton = screen.getByText('Add Service');
      await user.click(addButton);

      expect(window.flowDesk.workspace.addService).toHaveBeenCalledWith(
        'workspace-1',
        'Test Service',
        'web',
        'https://test.com'
      );
    });

    test('should open edit service modal when clicking edit', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(screen.getByTestId('edit-service-modal')).toBeInTheDocument();
    });

    test('should delete service when clicking delete', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(window.flowDesk.workspace.removeService).toHaveBeenCalledWith(
        'workspace-1',
        'service-1'
      );
    });

    test('should load service when clicking on service', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const serviceButton = screen.getByText('Gmail');
      await user.click(serviceButton);

      expect(window.flowDesk.workspace.loadService).toHaveBeenCalledWith(
        'workspace-1',
        'service-1'
      );
    });

    test('should show active service indicator', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const serviceButton = screen.getByText('Gmail');
      await user.click(serviceButton);

      await waitFor(() => {
        expect(screen.getByText('Gmail (Active)')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    test('should open search overlay with Ctrl+K', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      await user.keyboard('{Control>}k{/Control}');

      expect(screen.getByTestId('advanced-search')).toBeInTheDocument();
    });

    test('should close search overlay with Escape', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Open search
      await user.keyboard('{Control>}k{/Control}');
      expect(screen.getByTestId('advanced-search')).toBeInTheDocument();

      // Close with Escape
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByTestId('advanced-search')).not.toBeInTheDocument();
      });
    });

    test('should close search overlay when clicking outside', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Open search
      await user.keyboard('{Control>}k{/Control}');
      expect(screen.getByTestId('advanced-search')).toBeInTheDocument();

      // Click outside (on the overlay backdrop)
      const overlay = screen.getByTestId('advanced-search').closest('[role="dialog"]');
      if (overlay) {
        await user.click(overlay);
        await waitFor(() => {
          expect(screen.queryByTestId('advanced-search')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Accessibility Features', () => {
    test('should open accessibility settings with Ctrl+,', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      await user.keyboard('{Control>},{/Control}');

      expect(screen.getByTestId('accessibility-settings')).toBeInTheDocument();
    });

    test('should have proper ARIA labels', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
      expect(screen.getByRole('main', { name: 'Main application content' })).toBeInTheDocument();
    });

    test('should have skip links for screen readers', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      expect(screen.getByText('Skip to main content')).toBeInTheDocument();
      expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
    });
  });

  describe('Browser View Management', () => {
    test('should hide browser view when overlays are shown', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Open search overlay
      await user.keyboard('{Control>}k{/Control}');

      expect(window.flowDesk.browserView.hide).toHaveBeenCalled();
    });

    test('should show browser view when overlays are closed', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Open and close search overlay
      await user.keyboard('{Control>}k{/Control}');
      await user.keyboard('{Escape}');

      expect(window.flowDesk.browserView.show).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    test('should show global loading overlay', () => {
      const storeWithLoading = createMockStore({
        workspace: { loading: true }
      });

      render(
        <Provider store={storeWithLoading}>
          <App />
        </Provider>
      );

      // Note: The global loading would be controlled by component state
      // This test verifies the loading overlay component is rendered when needed
      expect(screen.getByTestId('loading-overlay')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle service loading errors gracefully', async () => {
      window.flowDesk.workspace.loadService = vi.fn().mockRejectedValue(new Error('Load failed'));

      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      const serviceButton = screen.getByText('Gmail');
      await user.click(serviceButton);

      // Should not crash the application
      expect(screen.getByTestId('services-sidebar')).toBeInTheDocument();
    });

    test('should handle add service errors gracefully', async () => {
      window.flowDesk.workspace.addService = vi.fn().mockRejectedValue(new Error('Add failed'));

      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Open modal and try to add service
      const addServiceButton = screen.getByText('Add Service');
      await user.click(addServiceButton);

      const addButton = screen.getByText('Add Service');
      await user.click(addButton);

      // Should not crash
      expect(screen.getByTestId('services-sidebar')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    test('should handle refresh shortcut', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      await user.keyboard('{Control>}r{/Control}');

      // Should trigger refresh (in real implementation would reload)
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should handle workspace navigation shortcut', async () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      await user.keyboard('{Control>}1{/Control}');

      // Should focus on workspace view (already focused by default)
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    test('should pass correct props to FlowDeskLeftRail', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Verify FlowDeskLeftRail receives correct props
      expect(screen.getByText('Workspace 1 (Active)')).toBeInTheDocument();
    });

    test('should pass correct props to ServicesSidebar', () => {
      render(
        <Provider store={store}>
          <App />
        </Provider>
      );

      // Verify ServicesSidebar shows correct workspace name and services
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Gmail')).toBeInTheDocument();
    });
  });
});