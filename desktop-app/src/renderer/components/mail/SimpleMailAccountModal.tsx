/**
 * Simple Mail Account Modal
 * 
 * Apple Mail approach - just email and password
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button, Card, cn } from '../ui';
import { X, Mail, Globe, Loader2 } from 'lucide-react';

interface SimpleMailAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (account: any) => void;
}

const SimpleMailAccountModal: React.FC<SimpleMailAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  console.log('🟡 SimpleMailAccountModal rendered with isOpen:', isOpen);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'testing' | 'setting-up' | 'completing' | null>(null);
  const [error, setError] = useState('');

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
      const credentials = {
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName || formData.email
      };

      // Step 1: Testing credentials
      setLoadingStep('testing');
      const testResult = await window.flowDesk?.productionEmail?.testEmailSetup(credentials);
      
      if (!testResult || !testResult.success) {
        throw new Error(testResult?.error || 'Email configuration test failed. Please check your credentials.');
      }

      // Step 2: Setting up account  
      setLoadingStep('setting-up');
      const accountResult = await window.flowDesk?.productionEmail?.setupAccount('current-user', credentials);
      
      if (!accountResult || !accountResult.success) {
        throw new Error(accountResult?.error || 'Failed to add email account.');
      }

      // Step 3: Completing
      setLoadingStep('completing');

      const account = {
        id: accountResult.accountId || 'new-account',
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName || formData.email,
        provider: testResult.serverConfig?.provider || 'auto',
        isEnabled: true
      };
      
      console.log('Simple mail account added:', account);
      onSuccess?.(account);
      
      // Reset form
      setFormData({
        email: '',
        password: '',
        displayName: ''
      });
      
      handleClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add mail account');
    } finally {
      setIsAdding(false);
      setLoadingStep(null);
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [handleClose])

  if (!isOpen) {
    console.log('🔴 SimpleMailAccountModal: isOpen is false, not rendering');
    return null;
  }
  
  console.log('🟢 SimpleMailAccountModal: isOpen is true, rendering modal');

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="relative w-full max-w-md bg-background rounded-lg border shadow-lg">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground mb-2">Add Mail Account</h2>
            <p className="text-sm text-muted-foreground">
              Supports Gmail, Outlook, Yahoo, FastMail, iCloud, and other IMAP providers
            </p>
          </div>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            loading={isAdding}
            leftIcon={isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          >
            {isAdding ? (
              loadingStep === 'testing' ? 'Testing Connection...' :
              loadingStep === 'setting-up' ? 'Setting Up Account...' :
              loadingStep === 'completing' ? 'Completing Setup...' :
              'Adding Account...'
            ) : 'Add Email Account'}
          </Button>
        </div>
      </form>
        </div>
      </div>
    </div>
  );
};

export default SimpleMailAccountModal;
export { SimpleMailAccountModal };