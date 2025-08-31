/**
 * Add Calendar Account Modal
 * 
 * Modal for adding CalDAV calendar accounts (Google, iCloud, etc.)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button, Card, cn } from '../ui';
import { X, Calendar, Globe } from 'lucide-react';

interface AddCalendarAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (account: any) => void;
}

export const AddCalendarAccountModal: React.FC<AddCalendarAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    provider: 'auto' // auto-detect from email domain
  });
  const [isAdding, setIsAdding] = useState(false);
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
      email: '',
      password: '',
      displayName: '',
      provider: 'auto'
    })
    setError('')
    onClose()
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;

    setIsAdding(true);
    setError('');

    try {
      // Call the calendar API to add account
      if (window.flowDesk?.calendar) {
        const account = await window.flowDesk.calendar.addAccount(
          formData.email,
          formData.password,
          { provider: formData.provider }
        );
        
        console.log('Calendar account added:', account);
        onSuccess?.(account);
        
        // Reset form
        setFormData({
          email: '',
          password: '',
          displayName: '',
          provider: 'auto'
        });
        
        handleClose();
      } else {
        throw new Error('Calendar API not available');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add calendar account');
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-modal-title"
    >
      <Card className="w-full max-w-md bg-card border-border" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 id="calendar-modal-title" className="text-xl font-semibold flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Add Calendar Account
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
            <div className="text-sm text-muted-foreground">
              <Globe className="h-4 w-4 inline mr-1" />
              Supports Google Calendar, iCloud, FastMail, and other CalDAV providers
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your.email@gmail.com"
                required
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Your email password or app password"
                required
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                For Gmail/Outlook, use an app-specific password instead of your main password
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name (Optional)</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="My Calendar"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.email || !formData.password || isAdding}
            >
              {isAdding ? 'Adding...' : 'Add Calendar'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AddCalendarAccountModal;