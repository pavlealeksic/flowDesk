/**
 * Hook to manage WebContentsView visibility when modals and overlays are open
 * 
 * This ensures proper z-index layering by hiding WebContentsViews when UI elements
 * that should be above them are displayed. Uses modern WebContentsView API.
 */

import { useEffect, useRef } from 'react'
import { shouldHideBrowserViews, type ZIndexLayer } from '../constants/zIndex'

interface WebContentsViewVisibilityOptions {
  isVisible: boolean
  layer?: ZIndexLayer
  onVisibilityChange?: (isVisible: boolean) => void
}

/**
 * Hook to control BrowserView visibility based on UI layer hierarchy
 */
export const useWebContentsViewVisibility = ({
  isVisible,
  layer = 'MODAL',
  onVisibilityChange
}: WebContentsViewVisibilityOptions) => {
  const previousVisibilityRef = useRef<boolean>(false)

  useEffect(() => {
    const shouldHide = isVisible && shouldHideWebContentsViews(layer)
    
    if (shouldHide && !previousVisibilityRef.current) {
      // Hide BrowserView
      if (window.flowDesk?.workspace?.hideBrowserViews) {
        window.flowDesk.workspace.hideBrowserViews()
      }
      previousVisibilityRef.current = true
      onVisibilityChange?.(false)
    } else if (!shouldHide && previousVisibilityRef.current) {
      // Show BrowserView
      if (window.flowDesk?.workspace?.showBrowserViews) {
        window.flowDesk.workspace.showBrowserViews()
      }
      previousVisibilityRef.current = false
      onVisibilityChange?.(true)
    }
  }, [isVisible, layer, onVisibilityChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previousVisibilityRef.current) {
        // Restore BrowserView visibility on cleanup
        if (window.flowDesk?.workspace?.showBrowserViews) {
          window.flowDesk.workspace.showBrowserViews()
        }
      }
    }
  }, [])
}

/**
 * Global state manager for tracking which overlays are currently blocking BrowserViews
 */
class BrowserViewVisibilityManager {
  private blockingOverlays = new Set<string>()
  private isHidden = false

  addBlockingOverlay(id: string, layer: ZIndexLayer) {
    if (shouldHideBrowserViews(layer)) {
      this.blockingOverlays.add(id)
      this.updateVisibility()
    }
  }

  removeBlockingOverlay(id: string) {
    this.blockingOverlays.delete(id)
    this.updateVisibility()
  }

  private updateVisibility() {
    const shouldHide = this.blockingOverlays.size > 0

    if (shouldHide && !this.isHidden) {
      if (window.flowDesk?.workspace?.hideBrowserViews) {
        window.flowDesk.workspace.hideBrowserViews()
      }
      this.isHidden = true
    } else if (!shouldHide && this.isHidden) {
      if (window.flowDesk?.workspace?.showBrowserViews) {
        window.flowDesk.workspace.showBrowserViews()
      }
      this.isHidden = false
    }
  }

  getBlockingOverlays(): string[] {
    return Array.from(this.blockingOverlays)
  }

  isCurrentlyHidden(): boolean {
    return this.isHidden
  }
}

// Global instance
const visibilityManager = new BrowserViewVisibilityManager()

/**
 * Hook to register/unregister an overlay that should block BrowserViews
 */
export const useBlockingOverlay = (
  id: string,
  isVisible: boolean,
  layer: ZIndexLayer = 'MODAL'
) => {
  useEffect(() => {
    if (isVisible) {
      visibilityManager.addBlockingOverlay(id, layer)
    } else {
      visibilityManager.removeBlockingOverlay(id)
    }

    // Cleanup on unmount or when visibility changes
    return () => {
      visibilityManager.removeBlockingOverlay(id)
    }
  }, [id, isVisible, layer])
}

/**
 * Hook to check if BrowserViews are currently hidden
 */
export const useBrowserViewStatus = () => {
  return {
    isHidden: visibilityManager.isCurrentlyHidden(),
    blockingOverlays: visibilityManager.getBlockingOverlays()
  }
}

export { visibilityManager as browserViewVisibilityManager }