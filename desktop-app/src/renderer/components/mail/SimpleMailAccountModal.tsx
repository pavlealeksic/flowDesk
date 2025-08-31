/**
 * Simple Mail Account Modal
 * 
 * Apple Mail approach - just email and password
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button, Card, cn } from '../ui';
import { X, Mail, Globe } from 'lucide-react';

interface SimpleMailAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (account: any) => void;
}

export const SimpleMailAccountModal: React.FC<SimpleMailAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: ''
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
      displayName: ''
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
      // Call the mail API to add account
      if (window.flowDesk?.mail) {
        const account = await window.flowDesk.mail.addAccount({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName || formData.email
        });
        
        console.log('Mail account added:', account);
        onSuccess?.(account);
        
        // Reset form
        setFormData({
          email: '',
          password: '',
          displayName: ''
        });
        
        handleClose();
      } else {
        throw new Error('Mail API not available');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add mail account');
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
      aria-labelledby="simple-mail-modal-title"
    >
      <Card className="w-full max-w-md bg-card border-border" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 id="simple-mail-modal-title" className="text-xl font-semibold flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Add Mail Account
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
              Supports Gmail, Outlook, Yahoo, FastMail, iCloud, and other IMAP providers
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
                placeholder="My Email"
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
              {isAdding ? 'Adding...' : 'Add Email Account'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SimpleMailAccountModal;