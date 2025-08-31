/**
 * Performance Optimization System
 * Comprehensive performance monitoring, optimization, and resource management
 */

export interface PerformanceConfig {
  enableMonitoring: boolean;
  enableOptimizations: boolean;
  memoryThreshold: number; // MB
  cpuThreshold: number; // percentage
  networkOptimization: boolean;
  imageOptimization: boolean;
  caching: {
    enabled: boolean;
    maxSize: number; // MB
    ttl: number; // seconds
    strategy: 'lru' | 'lfu' | 'ttl';
  };
  preloading: {
    enabled: boolean;
    prefetchRoutes: string[];
    prefetchResources: string[];
  };
  bundleOptimization: {
    enabled: boolean;
    compression: boolean;
    treeshaking: boolean;
    codesplitting: boolean;
  };
  resourceLimits: {
    maxConcurrentRequests: number;
    maxImageSize: number; // bytes
    maxFileUploadSize: number; // bytes
  };
}

export interface PerformanceMetrics {
  id: string;
  timestamp: number;
  category: MetricCategory;
  metrics: {
    // Core Web Vitals
    FCP?: number; // First Contentful Paint
    LCP?: number; // Largest Contentful Paint
    FID?: number; // First Input Delay
    CLS?: number; // Cumulative Layout Shift
    TTFB?: number; // Time to First Byte
    
    // Resource metrics
    memoryUsage: MemoryUsage;
    cpuUsage: number; // percentage
    networkUsage: NetworkUsage;
    diskUsage: DiskUsage;
    
    // Application metrics
    bundleSize: number;
    loadTime: number;
    renderTime: number;
    interactionTime: number;
    
    // Custom metrics
    [key: string]: any;
  };
  context: {
    platform: string;
    device: string;
    network: string;
    feature?: string;
    component?: string;
  };
}

export type MetricCategory = 
  | 'page_load' 
  | 'navigation' 
  | 'interaction' 
  | 'resource' 
  | 'background' 
  | 'api_call';

export interface MemoryUsage {
  used: number; // MB
  total: number; // MB
  percentage: number;
  breakdown?: {
    heap: number;
    external: number;
    buffers: number;
  };
}

export interface NetworkUsage {
  bytesReceived: number;
  bytesSent: number;
  requestCount: number;
  averageLatency: number;
  failureRate: number; // percentage
  slowRequestsCount: number; // requests > 1s
}

export interface DiskUsage {
  used: number; // MB
  available: number; // MB
  cacheSize: number; // MB
  tempSize: number; // MB
}

export interface PerformanceAlert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: any;
  timestamp: number;
  resolved: boolean;
  recommendations: string[];
}

export type AlertType = 
  | 'memory_high' 
  | 'cpu_high' 
  | 'slow_load' 
  | 'layout_shift' 
  | 'network_slow' 
  | 'bundle_large'
  | 'memory_leak'
  | 'resource_limit';

export interface OptimizationAction {
  id: string;
  type: OptimizationType;
  description: string;
  impact: 'low' | 'medium' | 'high';
  automated: boolean;
  execute: () => Promise<void>;
}

export type OptimizationType = 
  | 'lazy_load' 
  | 'prefetch' 
  | 'compress' 
  | 'cache' 
  | 'cleanup' 
  | 'debounce' 
  | 'throttle'
  | 'virtualize'
  | 'optimize_images'
  | 'reduce_bundle';

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer | null = null;
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  private cache: Map<string, { data: any; timestamp: number; size: number }> = new Map();
  private currentCacheSize: number = 0;
  private optimizations: Map<string, OptimizationAction> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private resourcePool: ResourcePool | null = null;

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.resourcePool = new ResourcePool();
  }

  static getInstance(config?: PerformanceConfig): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance && config) {
      PerformanceOptimizer.instance = new PerformanceOptimizer(config);
    } else if (!PerformanceOptimizer.instance) {
      throw new Error('PerformanceOptimizer must be initialized with config first');
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Initialize performance monitoring and optimization
   */
  async initialize(): Promise<void> {
    if (this.config.enableMonitoring) {
      this.setupPerformanceObservers();
      this.startMonitoring();
    }

    if (this.config.enableOptimizations) {
      this.setupOptimizations();
    }

    // Set up resource limits
    this.enforceResourceLimits();

    console.log('PerformanceOptimizer initialized');
  }

  /**
   * Record a performance metric
   */
  recordMetric(category: MetricCategory, metrics: any, context?: any): string {
    const metric: PerformanceMetrics = {
      id: this.generateId(),
      timestamp: Date.now(),
      category,
      metrics: {
        ...metrics,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCPUUsage(),
        networkUsage: this.getNetworkUsage(),
        diskUsage: this.getDiskUsage()
      },
      context: {
        platform: this.getPlatform(),
        device: this.getDeviceType(),
        network: this.getNetworkType(),
        ...context
      }
    };

    this.metrics.push(metric);
    this.analyzeMetric(metric);

    // Trim metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }

    return metric.id;
  }

  /**
   * Measure function performance
   */
  measureFunction<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    return this.measure(name, async () => {
      return await fn();
    });
  }

  /**
   * Generic performance measurement wrapper
   */
  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();
    
    try {
      const result = await operation();
      
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();
      const duration = endTime - startTime;
      
      this.recordMetric('api_call', {
        name,
        duration,
        memoryDelta: endMemory.used - startMemory.used,
        success: true
      });
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric('api_call', {
        name,
        duration,
        success: false,
        error: (error as Error).message
      });
      
      throw error;
    }
  }

  /**
   * Optimize image loading
   */
  optimizeImage(imageUrl: string, options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
  }): string {
    if (!this.config.imageOptimization) {
      return imageUrl;
    }

    const params = new URLSearchParams();
    if (options?.width) params.set('w', options.width.toString());
    if (options?.height) params.set('h', options.height.toString());
    if (options?.quality) params.set('q', options.quality.toString());
    if (options?.format) params.set('f', options.format);

    return `${imageUrl}?${params.toString()}`;
  }

  /**
   * Preload resources
   */
  async preloadResources(urls: string[]): Promise<void> {
    if (!this.config.preloading.enabled) {
      return;
    }

    const preloadPromises = urls.map(url => this.preloadResource(url));
    await Promise.allSettled(preloadPromises);
  }

  /**
   * Cache data with automatic cleanup
   */
  setCache(key: string, data: any, ttl?: number): void {
    if (!this.config.caching.enabled) {
      return;
    }

    const size = this.estimateSize(data);
    const expiry = ttl || this.config.caching.ttl;
    
    // Check if adding this item would exceed cache size
    if (this.currentCacheSize + size > this.config.caching.maxSize * 1024 * 1024) {
      this.cleanupCache();
    }

    // Remove existing item if present
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentCacheSize -= existing.size;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now() + (expiry * 1000),
      size
    });

    this.currentCacheSize += size;
  }

  /**
   * Get cached data
   */
  getCache(key: string): any | null {
    if (!this.config.caching.enabled) {
      return null;
    }

    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      this.currentCacheSize -= item.size;
      return null;
    }

    return item.data;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
  }

  /**
   * Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastExecTime = 0;

    return (...args: Parameters<T>) => {
      const currentTime = Date.now();

      if (currentTime - lastExecTime > delay) {
        func(...args);
        lastExecTime = currentTime;
      } else {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
          func(...args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  /**
   * Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  }

  /**
   * Create virtualized list for large datasets
   */
  createVirtualizedList(items: any[], itemHeight: number, containerHeight: number): {
    visibleItems: any[];
    scrollOffset: number;
    totalHeight: number;
  } {
    const totalItems = items.length;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const scrollOffset = 0; // This would be calculated based on scroll position
    const startIndex = Math.floor(scrollOffset / itemHeight);
    const endIndex = Math.min(startIndex + visibleCount + 1, totalItems);
    
    return {
      visibleItems: items.slice(startIndex, endIndex),
      scrollOffset,
      totalHeight: totalItems * itemHeight
    };
  }

  /**
   * Get performance analytics
   */
  getAnalytics(): {
    metrics: PerformanceMetrics[];
    alerts: PerformanceAlert[];
    averages: {
      loadTime: number;
      memoryUsage: number;
      cpuUsage: number;
    };
    trends: {
      loadTime: number[];
      memoryUsage: number[];
    };
  } {
    const recentMetrics = this.metrics.slice(-100);
    
    return {
      metrics: recentMetrics,
      alerts: this.alerts.filter(alert => !alert.resolved),
      averages: {
        loadTime: this.calculateAverage(recentMetrics, 'loadTime'),
        memoryUsage: this.calculateAverage(recentMetrics, m => m.metrics.memoryUsage.used),
        cpuUsage: this.calculateAverage(recentMetrics, m => m.metrics.cpuUsage)
      },
      trends: {
        loadTime: recentMetrics.map(m => m.metrics.loadTime || 0),
        memoryUsage: recentMetrics.map(m => m.metrics.memoryUsage.used)
      }
    };
  }

  /**
   * Apply automatic optimizations
   */
  async applyOptimizations(): Promise<string[]> {
    const applied: string[] = [];

    for (const [id, optimization] of this.optimizations) {
      if (optimization.automated) {
        try {
          await optimization.execute();
          applied.push(id);
          console.log(`Applied optimization: ${optimization.description}`);
        } catch (error) {
          console.error(`Failed to apply optimization ${id}:`, error);
        }
      }
    }

    return applied;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): OptimizationAction[] {
    const recommendations: OptimizationAction[] = [];

    // Analyze current performance and suggest optimizations
    const recentMetrics = this.metrics.slice(-10);
    
    if (recentMetrics.some(m => m.metrics.memoryUsage.percentage > 80)) {
      recommendations.push({
        id: 'memory_cleanup',
        type: 'cleanup',
        description: 'Clean up unused memory and cache',
        impact: 'high',
        automated: true,
        execute: async () => {
          this.cleanupCache();
          if (typeof global !== 'undefined' && global.gc) {
            global.gc();
          }
        }
      });
    }

    if (recentMetrics.some(m => m.metrics.loadTime > 3000)) {
      recommendations.push({
        id: 'lazy_loading',
        type: 'lazy_load',
        description: 'Enable lazy loading for images and components',
        impact: 'high',
        automated: false,
        execute: async () => {
          // Implementation would depend on the UI framework
        }
      });
    }

    return recommendations;
  }

  // Private methods

  private setupPerformanceObservers(): void {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not supported');
      return;
    }

    // Observe paint metrics
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('page_load', {
            [entry.name]: entry.startTime
          });
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);
    } catch (error) {
      console.warn('Paint observer not supported');
    }

    // Observe navigation metrics
    try {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const nav = entry as PerformanceNavigationTiming;
          this.recordMetric('page_load', {
            TTFB: nav.responseStart - nav.requestStart,
            loadTime: nav.loadEventEnd - nav.navigationStart,
            domContentLoaded: nav.domContentLoadedEventEnd - nav.navigationStart
          });
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    } catch (error) {
      console.warn('Navigation observer not supported');
    }

    // Observe LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('page_load', {
          LCP: lastEntry.startTime
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (error) {
      console.warn('LCP observer not supported');
    }

    // Observe FID
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('interaction', {
            FID: (entry as any).processingStart - entry.startTime
          });
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    } catch (error) {
      console.warn('FID observer not supported');
    }

    // Observe CLS
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('page_load', {
            CLS: (entry as any).value
          });
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (error) {
      console.warn('CLS observer not supported');
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.recordMetric('background', {
        timestamp: Date.now()
      });

      // Check for alerts
      this.checkPerformanceAlerts();

      // Apply automatic optimizations if enabled
      if (this.config.enableOptimizations) {
        this.applyOptimizations();
      }
    }, 30000); // Every 30 seconds
  }

  private setupOptimizations(): void {
    // Set up image lazy loading
    if (typeof document !== 'undefined') {
      this.setupImageLazyLoading();
    }

    // Set up prefetching
    if (this.config.preloading.enabled) {
      this.setupPrefetching();
    }

    // Set up compression
    if (this.config.bundleOptimization.compression) {
      this.setupCompression();
    }
  }

  private setupImageLazyLoading(): void {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              imageObserver.unobserve(img);
            }
          }
        });
      });

      // Observe all images with data-src attribute
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  private setupPrefetching(): void {
    // Prefetch specified routes and resources
    this.config.preloading.prefetchRoutes.forEach(route => {
      this.prefetchResource(route);
    });

    this.config.preloading.prefetchResources.forEach(resource => {
      this.prefetchResource(resource);
    });
  }

  private async preloadResource(url: string): Promise<void> {
    try {
      if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
      } else {
        // For Node.js environments, we might prefetch differently
        await fetch(url, { method: 'HEAD' });
      }
    } catch (error) {
      console.warn(`Failed to prefetch resource: ${url}`, error);
    }
  }

  private setupCompression(): void {
    // Set up response compression headers
    if (typeof Headers !== 'undefined') {
      const originalFetch = fetch;
      (global as any).fetch = (url: string, options?: RequestInit) => {
        const headers = new Headers(options?.headers);
        headers.set('Accept-Encoding', 'gzip, deflate, br');
        
        return originalFetch(url, {
          ...options,
          headers
        });
      };
    }
  }

  private enforceResourceLimits(): void {
    // Limit concurrent requests
    this.resourcePool?.setMaxConcurrent(this.config.resourceLimits.maxConcurrentRequests);

    // Set up file size validation
    if (typeof document !== 'undefined') {
      document.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        if (target.type === 'file' && target.files) {
          for (const file of Array.from(target.files)) {
            if (file.size > this.config.resourceLimits.maxFileUploadSize) {
              console.error(`File too large: ${file.name} (${file.size} bytes)`);
              target.value = '';
              break;
            }
          }
        }
      });
    }
  }

  private analyzeMetric(metric: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Check memory usage
    if (metric.metrics.memoryUsage.percentage > 90) {
      alerts.push({
        id: this.generateId(),
        type: 'memory_high',
        severity: 'critical',
        message: `Memory usage is critically high: ${metric.metrics.memoryUsage.percentage}%`,
        metrics: metric.metrics.memoryUsage,
        timestamp: Date.now(),
        resolved: false,
        recommendations: ['Clear cache', 'Restart application', 'Close unused features']
      });
    }

    // Check load time
    if (metric.metrics.loadTime && metric.metrics.loadTime > 5000) {
      alerts.push({
        id: this.generateId(),
        type: 'slow_load',
        severity: 'high',
        message: `Page load time is slow: ${metric.metrics.loadTime}ms`,
        metrics: { loadTime: metric.metrics.loadTime },
        timestamp: Date.now(),
        resolved: false,
        recommendations: ['Enable compression', 'Optimize images', 'Use CDN']
      });
    }

    // Check CLS
    if (metric.metrics.CLS && metric.metrics.CLS > 0.25) {
      alerts.push({
        id: this.generateId(),
        type: 'layout_shift',
        severity: 'medium',
        message: `High cumulative layout shift: ${metric.metrics.CLS}`,
        metrics: { CLS: metric.metrics.CLS },
        timestamp: Date.now(),
        resolved: false,
        recommendations: ['Add dimensions to images', 'Reserve space for dynamic content']
      });
    }

    this.alerts.push(...alerts);

    // Trim alerts to prevent memory issues
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  private checkPerformanceAlerts(): void {
    // Check for ongoing performance issues
    const recentMetrics = this.metrics.slice(-5);
    
    // Memory leak detection
    const memoryTrend = recentMetrics.map(m => m.metrics.memoryUsage.used);
    if (memoryTrend.length >= 3 && this.isIncreasingTrend(memoryTrend)) {
      const alert: PerformanceAlert = {
        id: this.generateId(),
        type: 'memory_leak',
        severity: 'high',
        message: 'Potential memory leak detected',
        metrics: { memoryTrend },
        timestamp: Date.now(),
        resolved: false,
        recommendations: ['Check for event listener leaks', 'Review object references', 'Clear intervals']
      };
      
      this.alerts.push(alert);
    }
  }

  private cleanupCache(): void {
    if (this.config.caching.strategy === 'lru') {
      // Remove least recently used items
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      while (this.currentCacheSize > this.config.caching.maxSize * 1024 * 1024 * 0.8) {
        const [key, value] = entries.shift()!;
        this.cache.delete(key);
        this.currentCacheSize -= value.size;
      }
    } else if (this.config.caching.strategy === 'ttl') {
      // Remove expired items
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now > value.timestamp) {
          this.cache.delete(key);
          this.currentCacheSize -= value.size;
        }
      }
    }
  }

  private getMemoryUsage(): MemoryUsage {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage();
      return {
        used: mem.heapUsed / 1024 / 1024,
        total: mem.heapTotal / 1024 / 1024,
        percentage: (mem.heapUsed / mem.heapTotal) * 100,
        breakdown: {
          heap: mem.heapUsed / 1024 / 1024,
          external: mem.external / 1024 / 1024,
          buffers: mem.arrayBuffers / 1024 / 1024
        }
      };
    } else if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      return {
        used: mem.usedJSHeapSize / 1024 / 1024,
        total: mem.totalJSHeapSize / 1024 / 1024,
        percentage: (mem.usedJSHeapSize / mem.totalJSHeapSize) * 100
      };
    }
    
    return { used: 0, total: 0, percentage: 0 };
  }

  private getCPUUsage(): number {
    // CPU usage calculation would be platform-specific
    // This is a placeholder
    return 0;
  }

  private getNetworkUsage(): NetworkUsage {
    // Network usage would be tracked separately
    // This is a placeholder
    return {
      bytesReceived: 0,
      bytesSent: 0,
      requestCount: 0,
      averageLatency: 0,
      failureRate: 0,
      slowRequestsCount: 0
    };
  }

  private getDiskUsage(): DiskUsage {
    // Disk usage would be platform-specific
    // This is a placeholder
    return {
      used: 0,
      available: 0,
      cacheSize: this.currentCacheSize / 1024 / 1024,
      tempSize: 0
    };
  }

  private getPlatform(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.platform;
    } else if (typeof process !== 'undefined') {
      return process.platform;
    }
    return 'unknown';
  }

  private getDeviceType(): string {
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
        return 'mobile';
      } else if (/tablet/i.test(userAgent)) {
        return 'tablet';
      }
      return 'desktop';
    }
    return 'unknown';
  }

  private getNetworkType(): string {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection?.effectiveType || 'unknown';
    }
    return 'unknown';
  }

  private estimateSize(data: any): number {
    // Rough estimation of object size
    return JSON.stringify(data).length * 2; // 2 bytes per character for UTF-16
  }

  private calculateAverage(metrics: PerformanceMetrics[], accessor: string | ((m: PerformanceMetrics) => number)): number {
    if (metrics.length === 0) return 0;
    
    const values = metrics.map(m => {
      if (typeof accessor === 'function') {
        return accessor(m);
      } else {
        return (m.metrics as any)[accessor] || 0;
      }
    }).filter(v => v > 0);
    
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private isIncreasingTrend(values: number[]): boolean {
    if (values.length < 2) return false;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] <= values[i - 1]) {
        return false;
      }
    }
    return true;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Disconnect observers
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];

    // Clear cache
    this.clearCache();

    // Dispose resource pool
    this.resourcePool?.dispose();
  }
}

// Resource Pool for managing concurrent operations
class ResourcePool {
  private maxConcurrent: number = 10;
  private activeOperations: number = 0;
  private queue: Array<{ fn: Function; resolve: Function; reject: Function }> = [];

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.processQueue();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: operation,
        resolve,
        reject
      });
      
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.activeOperations < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.activeOperations++;
      
      item.fn()
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.activeOperations--;
          this.processQueue();
        });
    }
  }

  dispose(): void {
    this.queue = [];
    this.activeOperations = 0;
  }
}

// Helper functions
export const createPerformanceOptimizer = (config: PerformanceConfig) => {
  return new PerformanceOptimizer(config);
};

export const getPerformanceOptimizer = () => {
  return PerformanceOptimizer.getInstance();
};

export const measurePerformance = <T>(name: string, operation: () => Promise<T> | T): Promise<T> => {
  return PerformanceOptimizer.getInstance().measureFunction(name, () => operation());
};