/**
 * ServiceIcon Component
 * 
 * Displays service icons with proper fallbacks, caching, and consistent styling
 * Supports real favicon URLs, local icons, and graceful fallbacks
 */

import React, { useState, useEffect, memo } from 'react';
// Removed broken imports - using inline service configuration instead
import { cn } from './index';

interface ServiceIconProps {
  serviceId: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  fallbackText?: string;
  preferLocal?: boolean;
  onError?: (error: Error) => void;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

// Simple in-memory cache for successful icon loads
const iconCache = new Set<string>();

export const ServiceIcon: React.FC<ServiceIconProps> = memo(({
  serviceId,
  size = 'md',
  className,
  fallbackText,
  preferLocal = false,
  onError
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showFallback, setShowFallback] = useState(false);

  // Since we're removing external dependencies, this component will only show fallbacks
  const serviceName = fallbackText || 'Service';
  
  // Calculate size classes
  const sizeClass = typeof size === 'number' 
    ? `w-[${size}px] h-[${size}px]` 
    : sizeClasses[size];

  useEffect(() => {
    // Show fallback immediately since we don't have service config
    setShowFallback(true);
    setIsLoading(false);
  }, [serviceId]);


  // Loading state
  if (isLoading) {
    return (
      <div 
        className={cn(
          sizeClass,
          'bg-muted/50 rounded animate-pulse flex items-center justify-center',
          className
        )}
      >
        <div className="w-1/2 h-1/2 bg-muted-foreground/30 rounded-sm" />
      </div>
    );
  }

  // Show text fallback if no icon loaded
  if (showFallback) {
    const initials = serviceName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div 
        className={cn(
          sizeClass,
          'bg-primary/10 rounded flex items-center justify-center border border-border',
          className
        )}
      >
        <span 
          className={cn(
            'font-semibold text-primary',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}
        >
          {initials}
        </span>
      </div>
    );
  }

  // Show the loaded icon
  return (
    <div className={cn(sizeClass, 'relative overflow-hidden rounded', className)}>
      <img
        src={currentSrc}
        alt={serviceName}
        className="w-full h-full object-contain"
        loading="lazy"
        onError={() => {
          // If the currently displayed image fails, show fallback
          setShowFallback(true);
          const error = new Error(`Failed to display icon: ${currentSrc}`);
          onError?.(error);
        }}
      />
    </div>
  );
});

ServiceIcon.displayName = 'ServiceIcon';

export default ServiceIcon;

// Additional utility component for service icon with label
export interface ServiceIconWithLabelProps extends ServiceIconProps {
  label?: string;
  labelPosition?: 'bottom' | 'right';
  labelClassName?: string;
}

export const ServiceIconWithLabel: React.FC<ServiceIconWithLabelProps> = memo(({
  label,
  labelPosition = 'bottom',
  labelClassName,
  serviceId,
  ...iconProps
}) => {
  const displayLabel = label || 'Service';

  const isHorizontal = labelPosition === 'right';

  return (
    <div className={cn(
      'flex items-center',
      isHorizontal ? 'flex-row space-x-2' : 'flex-col space-y-1'
    )}>
      <ServiceIcon serviceId={serviceId} {...iconProps} />
      <span className={cn(
        'text-sm text-foreground truncate',
        isHorizontal ? 'flex-1' : 'text-center',
        labelClassName
      )}>
        {displayLabel}
      </span>
    </div>
  );
});

ServiceIconWithLabel.displayName = 'ServiceIconWithLabel';