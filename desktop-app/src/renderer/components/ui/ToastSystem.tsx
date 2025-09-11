/**
 * Toast Notification System for Flow Desk
 * 
 * Provides lightweight, non-intrusive notifications for user feedback
 * on operations and errors that don't require modal dialogs.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { cn, Button, X, CheckCircle, AlertTriangle, XCircle, Info } from '../ui';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // in milliseconds, 0 for persistent
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastSystemProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxToasts?: number;
}

interface ToastComponentProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastComponent: React.FC<ToastComponentProps> = ({ toast, onDismiss }): JSX.Element => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Auto dismiss after duration
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration);
      
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast.duration]);

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 150); // Animation duration
  }, [toast.id, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getColorClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
      case 'info':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
      default:
        return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20';
    }
  };

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg transition-all duration-150',
        getColorClasses(),
        isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        isLeaving && 'translate-x-full opacity-0'
      )}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {toast.title}
            </p>
            {toast.message && (
              <p className="mt-1 text-sm text-muted-foreground">
                {toast.message}
              </p>
            )}
            {toast.action && (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toast.action.onClick}
                  className="text-xs"
                >
                  {toast.action.label}
                </Button>
              </div>
            )}
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="inline-flex rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-6 w-6 p-0"
            >
              <span className="sr-only">Close</span>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ToastSystem: React.FC<ToastSystemProps> = ({
  position = 'top-right',
  maxToasts = 5
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000 // Default 5 seconds
    };

    setToasts(prev => {
      const updated = [newToast, ...prev];
      // Limit number of toasts
      return updated.slice(0, maxToasts);
    });

    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Expose functions to global scope
  useEffect(() => {
    (window as any).flowDeskToast = {
      success: (title: string, message?: string, options?: Partial<Toast>) =>
        addToast({ type: 'success', title, message, ...options }),
      error: (title: string, message?: string, options?: Partial<Toast>) =>
        addToast({ type: 'error', title, message, ...options }),
      warning: (title: string, message?: string, options?: Partial<Toast>) =>
        addToast({ type: 'warning', title, message, ...options }),
      info: (title: string, message?: string, options?: Partial<Toast>) =>
        addToast({ type: 'info', title, message, ...options }),
      add: addToast,
      remove: removeToast,
      clear: clearAllToasts
    };

    return () => {
      delete (window as any).flowDeskToast;
    };
  }, [addToast, removeToast, clearAllToasts]);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-50 flex flex-col space-y-2',
        getPositionClasses()
      )}
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastComponent
          key={toast.id}
          toast={toast}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
};

// Hook to use toast system
export const useToast = () => {
  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    if ((window as any).flowDeskToast) {
      return (window as any).flowDeskToast.add(toast);
    }
  }, []);

  const showSuccess = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    if ((window as any).flowDeskToast) {
      return (window as any).flowDeskToast.success(title, message, options);
    }
  }, []);

  const showError = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    if ((window as any).flowDeskToast) {
      return (window as any).flowDeskToast.error(title, message, options);
    }
  }, []);

  const showWarning = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    if ((window as any).flowDeskToast) {
      return (window as any).flowDeskToast.warning(title, message, options);
    }
  }, []);

  const showInfo = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    if ((window as any).flowDeskToast) {
      return (window as any).flowDeskToast.info(title, message, options);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    if ((window as any).flowDeskToast) {
      (window as any).flowDeskToast.remove(id);
    }
  }, []);

  const clearAllToasts = useCallback(() => {
    if ((window as any).flowDeskToast) {
      (window as any).flowDeskToast.clear();
    }
  }, []);

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
    clearAllToasts
  };
};


export default ToastSystem;