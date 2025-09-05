/**
 * Comprehensive Service Icon Configuration
 * Maps all 44+ services to their real favicon URLs and local fallbacks
 */
export interface ServiceIconConfig {
    id: string;
    name: string;
    faviconUrl: string;
    localIcon: string;
    fallbackIcon: string;
    color: string;
    category: string;
}
export declare const SERVICE_ICONS: Record<string, ServiceIconConfig>;
export declare const getServiceIcon: (serviceId: string) => ServiceIconConfig | null;
export declare const getServiceIconUrl: (serviceId: string, preferLocal?: boolean) => string;
export declare const getServiceFallbackUrl: (serviceId: string) => string;
export declare const getServicesByCategory: () => Record<string, ServiceIconConfig[]>;
export declare const getAllServiceIcons: () => ServiceIconConfig[];
//# sourceMappingURL=service-icons.d.ts.map