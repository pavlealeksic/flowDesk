/**
 * Performance Optimization System
 * Comprehensive performance monitoring, optimization, and resource management
 */
export interface PerformanceConfig {
    enableMonitoring: boolean;
    enableOptimizations: boolean;
    memoryThreshold: number;
    cpuThreshold: number;
    networkOptimization: boolean;
    imageOptimization: boolean;
    caching: {
        enabled: boolean;
        maxSize: number;
        ttl: number;
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
        maxImageSize: number;
        maxFileUploadSize: number;
    };
}
export interface PerformanceMetrics {
    id: string;
    timestamp: number;
    category: MetricCategory;
    metrics: {
        FCP?: number;
        LCP?: number;
        FID?: number;
        CLS?: number;
        TTFB?: number;
        memoryUsage: MemoryUsage;
        cpuUsage: number;
        networkUsage: NetworkUsage;
        diskUsage: DiskUsage;
        bundleSize: number;
        loadTime: number;
        renderTime: number;
        interactionTime: number;
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
export type MetricCategory = 'page_load' | 'navigation' | 'interaction' | 'resource' | 'background' | 'api_call';
export interface MemoryUsage {
    used: number;
    total: number;
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
    failureRate: number;
    slowRequestsCount: number;
}
export interface DiskUsage {
    used: number;
    available: number;
    cacheSize: number;
    tempSize: number;
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
export type AlertType = 'memory_high' | 'cpu_high' | 'slow_load' | 'layout_shift' | 'network_slow' | 'bundle_large' | 'memory_leak' | 'resource_limit';
export interface OptimizationAction {
    id: string;
    type: OptimizationType;
    description: string;
    impact: 'low' | 'medium' | 'high';
    automated: boolean;
    execute: () => Promise<void>;
}
export type OptimizationType = 'lazy_load' | 'prefetch' | 'compress' | 'cache' | 'cleanup' | 'debounce' | 'throttle' | 'virtualize' | 'optimize_images' | 'reduce_bundle';
export declare class PerformanceOptimizer {
    private static instance;
    private config;
    private metrics;
    private alerts;
    private observers;
    private cache;
    private currentCacheSize;
    private optimizations;
    private monitoringInterval;
    private resourcePool;
    constructor(config: PerformanceConfig);
    static getInstance(config?: PerformanceConfig): PerformanceOptimizer;
    /**
     * Initialize performance monitoring and optimization
     */
    initialize(): Promise<void>;
    /**
     * Record a performance metric
     */
    recordMetric(category: MetricCategory, metrics: any, context?: any): string;
    /**
     * Measure function performance
     */
    measureFunction<T>(name: string, fn: () => Promise<T> | T): Promise<T>;
    /**
     * Generic performance measurement wrapper
     */
    measure<T>(name: string, operation: () => Promise<T>): Promise<T>;
    /**
     * Optimize image loading
     */
    optimizeImage(imageUrl: string, options?: {
        width?: number;
        height?: number;
        quality?: number;
        format?: 'webp' | 'avif' | 'jpeg' | 'png';
    }): string;
    /**
     * Preload resources
     */
    preloadResources(urls: string[]): Promise<void>;
    /**
     * Cache data with automatic cleanup
     */
    setCache(key: string, data: any, ttl?: number): void;
    /**
     * Get cached data
     */
    getCache(key: string): any | null;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Throttle function calls
     */
    throttle<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void;
    /**
     * Debounce function calls
     */
    debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void;
    /**
     * Create virtualized list for large datasets
     */
    createVirtualizedList(items: any[], itemHeight: number, containerHeight: number): {
        visibleItems: any[];
        scrollOffset: number;
        totalHeight: number;
    };
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
    };
    /**
     * Apply automatic optimizations
     */
    applyOptimizations(): Promise<string[]>;
    /**
     * Get optimization recommendations
     */
    getOptimizationRecommendations(): OptimizationAction[];
    private setupPerformanceObservers;
    private startMonitoring;
    private setupOptimizations;
    private setupImageLazyLoading;
    private setupPrefetching;
    private prefetchResource;
    private preloadResource;
    private setupCompression;
    private enforceResourceLimits;
    private analyzeMetric;
    private checkPerformanceAlerts;
    private cleanupCache;
    private getMemoryUsage;
    private getCPUUsage;
    private getNetworkUsage;
    private getDiskUsage;
    private getPlatform;
    private getDeviceType;
    private getNetworkType;
    private estimateSize;
    private calculateAverage;
    private isIncreasingTrend;
    private generateId;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
export declare const createPerformanceOptimizer: (config: PerformanceConfig) => PerformanceOptimizer;
export declare const getPerformanceOptimizer: () => PerformanceOptimizer;
export declare const measurePerformance: <T>(name: string, operation: () => Promise<T> | T) => Promise<T>;
//# sourceMappingURL=performance-optimizer.d.ts.map