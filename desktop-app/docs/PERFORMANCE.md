# Flow Desk Performance Guide

This document outlines Flow Desk's performance optimization strategies, monitoring techniques, and best practices for maintaining optimal application performance.

## Table of Contents

- [Performance Overview](#performance-overview)
- [Performance Metrics](#performance-metrics)
- [Memory Management](#memory-management)
- [Browser View Optimization](#browser-view-optimization)
- [React Performance](#react-performance)
- [Electron Optimization](#electron-optimization)
- [Bundle Optimization](#bundle-optimization)
- [Performance Monitoring](#performance-monitoring)
- [Troubleshooting](#troubleshooting)

## Performance Overview

Flow Desk's performance strategy focuses on several key areas:

- **Startup Time**: Fast application initialization
- **Memory Usage**: Efficient memory management across processes
- **UI Responsiveness**: Smooth user interactions
- **Service Loading**: Quick service initialization
- **Resource Utilization**: Optimal CPU and GPU usage

### Performance Goals

- **Cold Start**: < 3 seconds to ready state
- **Workspace Switch**: < 500ms
- **Service Load**: < 2 seconds for new services
- **Memory Usage**: < 200MB for main app + 50MB per active service
- **UI Response**: < 100ms for user interactions

## Performance Metrics

### Core Metrics Tracked

1. **Application Metrics**
   - Startup time (cold/warm)
   - Memory usage per process
   - CPU utilization
   - GPU usage (if applicable)

2. **User Experience Metrics**
   - Time to Interactive (TTI)
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Cumulative Layout Shift (CLS)

3. **Electron-Specific Metrics**
   - Process count
   - IPC message throughput
   - Browser view creation time
   - Navigation timing

### Measurement Tools

```typescript
// Performance monitoring setup
class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    this.recordMetric(name, duration);
    return result;
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    this.recordMetric(name, duration);
    return result;
  }

  private recordMetric(name: string, duration: number): void {
    const existing = this.metrics.get(name) || [];
    existing.push(duration);
    
    // Keep only last 100 measurements
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.metrics.set(name, existing);
  }

  getStats(name: string) {
    const measurements = this.metrics.get(name) || [];
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((a, b) => a + b) / measurements.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
}

// Global performance monitor
export const perfMonitor = new PerformanceMonitor();
```

## Memory Management

### Browser View Lifecycle

```typescript
class OptimizedWorkspaceManager extends EventEmitter {
  private browserViews = new Map<string, BrowserView>();
  private lastAccessTime = new Map<string, number>();
  private readonly MAX_CONCURRENT_VIEWS = 5;
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds

  constructor() {
    super();
    // Periodic cleanup of unused browser views
    setInterval(() => this.cleanupUnusedViews(), this.CLEANUP_INTERVAL);
  }

  async loadService(workspaceId: string, serviceId: string): Promise<void> {
    // Track access time for LRU cleanup
    this.lastAccessTime.set(serviceId, Date.now());

    let browserView = this.browserViews.get(serviceId);
    if (!browserView) {
      // Check if we need to cleanup old views first
      await this.ensureViewLimit();
      
      browserView = await perfMonitor.measureAsync('browser-view-creation', () =>
        this.createBrowserViewForService(service, workspace)
      );
      
      this.browserViews.set(serviceId, browserView);
    }

    // Show the browser view
    await this.showBrowserView(browserView);
  }

  private async ensureViewLimit(): Promise<void> {
    if (this.browserViews.size < this.MAX_CONCURRENT_VIEWS) {
      return;
    }

    // Find least recently used view
    let oldestServiceId = '';
    let oldestTime = Date.now();

    for (const [serviceId, time] of this.lastAccessTime) {
      if (time < oldestTime && serviceId !== this.currentServiceId) {
        oldestTime = time;
        oldestServiceId = serviceId;
      }
    }

    if (oldestServiceId) {
      await this.cleanupBrowserView(oldestServiceId);
    }
  }

  private cleanupUnusedViews(): void {
    const cutoffTime = Date.now() - 300000; // 5 minutes
    const toCleanup: string[] = [];

    for (const [serviceId, lastAccess] of this.lastAccessTime) {
      if (lastAccess < cutoffTime && serviceId !== this.currentServiceId) {
        toCleanup.push(serviceId);
      }
    }

    toCleanup.forEach(serviceId => this.cleanupBrowserView(serviceId));
  }

  private async cleanupBrowserView(serviceId: string): Promise<void> {
    const browserView = this.browserViews.get(serviceId);
    if (browserView) {
      // Graceful cleanup
      if (this.mainWindow) {
        this.mainWindow.removeBrowserView(browserView);
      }

      // Clear session data if needed
      await browserView.webContents.session.clearStorageData({
        storages: ['cookies', 'localstorage', 'sessionstorage', 'websql', 'indexdb']
      });

      // Destroy the view
      (browserView.webContents as any).destroy();
      
      this.browserViews.delete(serviceId);
      this.lastAccessTime.delete(serviceId);
      
      console.log(`Cleaned up browser view for service: ${serviceId}`);
    }
  }
}
```

### Memory Leak Prevention

```typescript
// React component cleanup hook
export const useMemoryCleanup = (options: {
  maxItems: number;
  cleanupInterval: number;
  enablePerfMonitoring: boolean;
}) => {
  useEffect(() => {
    let cleanup: NodeJS.Timeout | null = null;

    if (options.enablePerfMonitoring) {
      cleanup = setInterval(() => {
        // Check for memory leaks in development
        if (process.env.NODE_ENV === 'development') {
          const memUsage = process.memoryUsage();
          console.log('Memory Usage:', {
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
          });
        }
      }, options.cleanupInterval);
    }

    return () => {
      if (cleanup) {
        clearInterval(cleanup);
      }
    };
  }, [options.cleanupInterval, options.enablePerfMonitoring]);
};

// Memory-efficient component wrapper
export function withMemoryOptimization<P extends object>(
  Component: React.ComponentType<P>,
  displayName?: string
): React.ComponentType<P> {
  const MemoizedComponent = React.memo(Component);
  MemoizedComponent.displayName = displayName || Component.displayName || Component.name;
  
  return (props: P) => {
    // Track component mount/unmount for memory monitoring
    useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Component mounted: ${MemoizedComponent.displayName}`);
        return () => {
          console.log(`Component unmounted: ${MemoizedComponent.displayName}`);
        };
      }
    }, []);

    return <MemoizedComponent {...props} />;
  };
}
```

## Browser View Optimization

### Efficient Browser View Management

```typescript
class BrowserViewPool {
  private pool: BrowserView[] = [];
  private inUse = new Set<BrowserView>();
  private readonly MAX_POOL_SIZE = 3;

  getBrowserView(config: BrowserViewConfig): BrowserView {
    // Try to reuse from pool
    let browserView = this.pool.pop();
    
    if (!browserView) {
      browserView = new BrowserView({
        webPreferences: {
          ...config.webPreferences,
          backgroundThrottling: false, // Prevent throttling for better performance
          webgl: false, // Disable WebGL if not needed
          plugins: false, // Disable plugins for security and performance
        }
      });
    }

    this.inUse.add(browserView);
    return browserView;
  }

  returnBrowserView(browserView: BrowserView): void {
    if (!this.inUse.has(browserView)) return;

    this.inUse.delete(browserView);

    if (this.pool.length < this.MAX_POOL_SIZE) {
      // Reset browser view state
      browserView.webContents.loadURL('about:blank');
      this.pool.push(browserView);
    } else {
      // Destroy excess views
      (browserView.webContents as any).destroy();
    }
  }
}

// Optimized positioning with throttling
class BrowserViewPositioner {
  private positioningTimer: NodeJS.Timeout | null = null;
  private pendingViews = new Set<BrowserView>();

  positionBrowserView(browserView: BrowserView): void {
    this.pendingViews.add(browserView);

    // Throttle positioning to avoid excessive calls
    if (this.positioningTimer) {
      clearTimeout(this.positioningTimer);
    }

    this.positioningTimer = setTimeout(() => {
      this.processPendingPositions();
    }, 16); // ~60fps
  }

  private processPendingPositions(): void {
    const views = Array.from(this.pendingViews);
    this.pendingViews.clear();

    // Batch position updates
    views.forEach(view => {
      if (this.mainWindow && !view.webContents.isDestroyed()) {
        const bounds = this.calculateBounds();
        view.setBounds(bounds);
      }
    });

    this.positioningTimer = null;
  }
}
```

### Service Loading Optimization

```typescript
// Preload frequently used services
class ServicePreloader {
  private preloadedServices = new Map<string, BrowserView>();
  private preloadQueue: string[] = [];

  preloadPopularServices(workspaceId: string): void {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return;

    // Sort services by usage frequency
    const popularServices = workspace.services
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 3); // Preload top 3

    popularServices.forEach(service => {
      this.preloadQueue.push(service.id);
    });

    // Process preload queue in the background
    this.processPreloadQueue();
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.preloadQueue.length === 0) return;

    const serviceId = this.preloadQueue.shift()!;
    
    // Only preload if not already loaded
    if (!this.preloadedServices.has(serviceId)) {
      try {
        const browserView = await this.createBrowserViewForService(serviceId);
        
        // Load service URL in background
        await browserView.webContents.loadURL(service.url);
        
        this.preloadedServices.set(serviceId, browserView);
        
        // Continue with next service
        setTimeout(() => this.processPreloadQueue(), 1000);
      } catch (error) {
        console.warn(`Failed to preload service ${serviceId}:`, error);
      }
    }
  }
}
```

## React Performance

### Component Optimization

```typescript
// Memoization strategies
const ServicesList = React.memo<ServicesListProps>(({ services, onServiceSelect }) => {
  // Memoize filtered/sorted services
  const sortedServices = useMemo(() => {
    return services
      .filter(service => service.isEnabled)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  // Memoize click handlers
  const handleServiceClick = useCallback((serviceId: string) => {
    onServiceSelect(serviceId);
  }, [onServiceSelect]);

  return (
    <div>
      {sortedServices.map(service => (
        <ServiceItem
          key={service.id}
          service={service}
          onClick={handleServiceClick}
        />
      ))}
    </div>
  );
});

// Virtual scrolling for large lists
const VirtualizedServiceList = ({ services, onServiceSelect }) => {
  const listRef = useRef<FixedSizeList>(null);

  const ServiceRow = useCallback(({ index, style }: ListChildComponentProps) => {
    const service = services[index];
    return (
      <div style={style}>
        <ServiceItem service={service} onClick={onServiceSelect} />
      </div>
    );
  }, [services, onServiceSelect]);

  return (
    <FixedSizeList
      ref={listRef}
      height={400}
      itemCount={services.length}
      itemSize={60}
      width="100%"
    >
      {ServiceRow}
    </FixedSizeList>
  );
};
```

### State Management Optimization

```typescript
// Optimized selectors with memoization
export const selectSortedWorkspaces = createSelector(
  [selectAllWorkspaces],
  (workspaces) => {
    return [...workspaces].sort((a, b) => 
      new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    );
  }
);

// Normalized state structure
interface OptimizedWorkspaceState {
  // Normalized data
  workspaces: Record<string, Workspace>;
  services: Record<string, WorkspaceService>;
  
  // Lookup tables
  workspaceServices: Record<string, string[]>; // workspaceId -> serviceIds
  
  // UI state
  currentWorkspaceId: string | null;
  activeServiceId: string | null;
  
  // Status
  isLoading: boolean;
  error: string | null;
}

// Batch updates to reduce re-renders
const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    batchUpdate: (state, action: PayloadAction<Partial<OptimizedWorkspaceState>>) => {
      Object.assign(state, action.payload);
    }
  }
});
```

### Image and Asset Optimization

```typescript
// Lazy image loading component
const LazyImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}> = ({ src, alt, className, fallback = '/assets/default-icon.svg' }) => {
  const [imageSrc, setImageSrc] = useState(fallback);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const image = new Image();
          image.onload = () => {
            setImageSrc(src);
            setIsLoaded(true);
          };
          image.onerror = () => {
            setImageSrc(fallback);
            setIsLoaded(true);
          };
          image.src = src;
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(img);
    return () => observer.disconnect();
  }, [src, fallback]);

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={cn(className, !isLoaded && 'opacity-50')}
    />
  );
};
```

## Electron Optimization

### Process Management

```typescript
// Optimize main process
app.commandLine.appendSwitch('--enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');

// Memory optimization
app.commandLine.appendSwitch('--max-old-space-size', '512'); // Limit heap size
app.commandLine.appendSwitch('--optimize-for-size'); // Optimize for memory over speed

// GPU acceleration (if beneficial)
if (process.platform !== 'linux') {
  app.commandLine.appendSwitch('--enable-gpu-acceleration');
}
```

### IPC Optimization

```typescript
// Batch IPC messages
class IPCBatcher {
  private batches = new Map<string, any[]>();
  private timers = new Map<string, NodeJS.Timeout>();
  private readonly BATCH_DELAY = 16; // One frame at 60fps

  batchSend(channel: string, data: any): void {
    if (!this.batches.has(channel)) {
      this.batches.set(channel, []);
    }

    this.batches.get(channel)!.push(data);

    // Clear existing timer
    const existingTimer = this.timers.get(channel);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.flushBatch(channel);
    }, this.BATCH_DELAY);

    this.timers.set(channel, timer);
  }

  private flushBatch(channel: string): void {
    const batch = this.batches.get(channel);
    if (batch && batch.length > 0) {
      ipcRenderer.send(`${channel}:batch`, batch);
      this.batches.set(channel, []);
    }
    this.timers.delete(channel);
  }
}

// Use structured cloning for large data
const sendLargeData = (channel: string, data: any) => {
  // Use structured cloning algorithm for better performance
  ipcRenderer.invoke(channel, structuredClone(data));
};
```

## Bundle Optimization

### Webpack/Vite Configuration

```typescript
// vite.config.ts optimizations
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks
          vendor: ['react', 'react-dom', '@reduxjs/toolkit'],
          ui: ['lucide-react', 'framer-motion'],
          utils: ['date-fns', 'lodash-es']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: process.env.NODE_ENV === 'development'
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@reduxjs/toolkit',
      'react-redux'
    ]
  }
});
```

### Code Splitting

```typescript
// Dynamic imports for large components
const AdvancedSettings = lazy(() => 
  import('./components/settings/AdvancedSettings').then(module => ({
    default: module.AdvancedSettings
  }))
);

// Route-based splitting
const WorkspaceView = lazy(() => import('./views/WorkspaceView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

// Feature-based splitting
const useAdvancedFeature = () => {
  const [feature, setFeature] = useState<any>(null);

  const loadFeature = useCallback(async () => {
    if (!feature) {
      const { AdvancedFeature } = await import('./features/AdvancedFeature');
      setFeature(AdvancedFeature);
    }
  }, [feature]);

  return { feature, loadFeature };
};
```

## Performance Monitoring

### Real-time Metrics

```typescript
// Performance metrics collection
class MetricsCollector {
  private metrics: Record<string, number[]> = {};

  startTimer(name: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
    };
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    this.metrics[name].push(value);

    // Keep only recent metrics
    if (this.metrics[name].length > 1000) {
      this.metrics[name] = this.metrics[name].slice(-500);
    }
  }

  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    for (const [name, values] of Object.entries(this.metrics)) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      report[name] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b) / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p90: sorted[Math.floor(sorted.length * 0.9)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }

    return report;
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();
```

### Performance Alerts

```typescript
// Performance threshold monitoring
class PerformanceWatcher {
  private thresholds = {
    'workspace-switch': 1000,
    'service-load': 3000,
    'component-render': 100
  };

  checkPerformance(name: string, duration: number): void {
    const threshold = this.thresholds[name];
    if (threshold && duration > threshold) {
      this.alertSlowPerformance(name, duration, threshold);
    }
  }

  private alertSlowPerformance(name: string, duration: number, threshold: number): void {
    console.warn(`Performance alert: ${name} took ${duration}ms (threshold: ${threshold}ms)`);
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendPerformanceAlert(name, duration, threshold);
    }
  }

  private sendPerformanceAlert(name: string, duration: number, threshold: number): void {
    // Send to monitoring service
    fetch('/api/performance/alert', {
      method: 'POST',
      body: JSON.stringify({
        metric: name,
        duration,
        threshold,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        version: process.env.REACT_APP_VERSION
      })
    });
  }
}
```

## Troubleshooting

### Common Performance Issues

#### High Memory Usage

**Symptoms:**
- Application becomes slow over time
- System memory usage continues to grow
- Browser views become unresponsive

**Solutions:**
```typescript
// Enable memory monitoring
const monitorMemoryUsage = () => {
  setInterval(() => {
    const memInfo = process.getProcessMemoryInfo();
    console.log('Memory usage:', {
      private: Math.round(memInfo.private / 1024) + 'KB',
      shared: Math.round(memInfo.shared / 1024) + 'KB',
      residentSet: Math.round(memInfo.residentSet / 1024) + 'KB'
    });

    // Alert if memory usage is too high
    if (memInfo.private > 500 * 1024 * 1024) { // 500MB
      console.warn('High memory usage detected');
      // Trigger cleanup
      this.cleanupUnusedResources();
    }
  }, 30000);
};
```

#### Slow Service Loading

**Symptoms:**
- Services take a long time to load
- Browser views appear blank for extended periods
- Network requests timing out

**Solutions:**
```typescript
// Implement service loading timeout
const loadServiceWithTimeout = async (serviceId: string, timeout = 30000): Promise<void> => {
  return Promise.race([
    this.loadService(serviceId),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Service load timeout')), timeout)
    )
  ]);
};

// Preload critical services
const preloadCriticalServices = async () => {
  const criticalServices = this.getCriticalServices();
  await Promise.all(
    criticalServices.map(service => this.preloadService(service.id))
  );
};
```

#### UI Freezing

**Symptoms:**
- Interface becomes unresponsive
- Click events don't register
- Animations stop or stutter

**Solutions:**
```typescript
// Break up heavy operations
const processLargeDataset = async (data: any[]) => {
  const CHUNK_SIZE = 100;
  const chunks = [];
  
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    await new Promise(resolve => {
      requestIdleCallback(() => {
        processChunk(chunk);
        resolve(void 0);
      });
    });
  }
};
```

### Performance Debugging Tools

```bash
# Enable Chrome DevTools for main process
npm run dev:main -- --inspect

# Enable performance profiling
ELECTRON_ENABLE_LOGGING=true npm run dev

# Generate performance report
npm run perf:report

# Analyze bundle size
npm run bundle:analyze
```

---

This performance guide provides comprehensive strategies for maintaining optimal Flow Desk performance across all aspects of the application.