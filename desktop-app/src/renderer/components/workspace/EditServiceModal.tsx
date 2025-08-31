/**
 * Edit Service Modal
 * 
 * Modal for editing workspace service settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, cn } from '../ui';
import { X, Globe, Edit } from 'lucide-react';

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  serviceId: string | null;
  currentService?: {
    id: string;
    name: string;
    type: string;
    url: string;
    isEnabled: boolean;
  };
  onSave?: (serviceId: string, updates: { name: string; url: string; isEnabled: boolean }) => void;
}

export const EditServiceModal: React.FC<EditServiceModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  serviceId,
  currentService,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    isEnabled: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Add ESC key handling and prevent body scroll
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }, [])

  const handleClose = useCallback(() => {
    setFormData({
      name: '',
      url: '',
      isEnabled: true
    })
    setError('')
    onClose()
  }, [onClose])

  // Load current service data when modal opens
  useEffect(() => {
    if (isOpen && currentService) {
      setFormData({
        name: currentService.name,
        url: currentService.url,
        isEnabled: currentService.isEnabled
      });
    }
  }, [isOpen, currentService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url || !serviceId) return;

    setIsSaving(true);
    setError('');

    try {
      // Use the flowDesk workspace API to update the service
      if (window.flowDesk?.workspace) {
        await window.flowDesk.workspace.updateService(
          workspaceId,
          serviceId,
          {
            name: formData.name,
            url: formData.url,
            isEnabled: formData.isEnabled
          }
        );
        
        // Also call the optional callback for UI updates
        onSave?.(serviceId, formData);
        
        handleClose();
      } else {
        throw new Error('FlowDesk workspace API not available');
      }
    } catch (error) {
      console.error('Failed to update service:', error);
      setError(error instanceof Error ? error.message : 'Failed to save service');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !serviceId) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-service-modal-title"
    >
      <Card className="w-full max-w-md bg-card border-border" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 id="edit-service-modal-title" className="text-xl font-semibold flex items-center">
              <Edit className="h-5 w-5 mr-2" />
              Edit Service
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Service Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Slack, Notion, GitHub, etc."
                required
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Service URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://app.slack.com"
                required
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                The web URL for this service
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Service Enabled</label>
                <p className="text-xs text-muted-foreground">Enable or disable this service</p>
              </div>
              <input
                type="checkbox"
                checked={formData.isEnabled}
                onChange={(e) => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
                className="rounded"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.name || !formData.url || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default EditServiceModal;