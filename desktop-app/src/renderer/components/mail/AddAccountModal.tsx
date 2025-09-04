import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  Button,
  Input,
  Card,
  cn,
  X,
  Mail,
  Globe,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from '../ui'
import { type BaseComponentProps } from '../ui/types'
import { addMailAccount, selectIsLoadingMail, selectMailError } from '../../store/slices/mailSlice'
import type { MailProvider } from '@flow-desk/shared'

interface AddAccountModalProps extends BaseComponentProps {
  isOpen: boolean
  onClose: () => void
}

type SetupStep = 'provider' | 'credentials' | 'success'

interface ProviderInfo {
  id: MailProvider
  name: string
  icon: string
  description: string
  popular?: boolean
  defaultImap?: string
  defaultSmtp?: string
  defaultImapPort?: number
  defaultSmtpPort?: number
}

const providers: ProviderInfo[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    description: 'Gmail accounts with email + password',
    popular: true,
    defaultImap: 'imap.gmail.com',
    defaultSmtp: 'smtp.gmail.com',
    defaultImapPort: 993,
    defaultSmtpPort: 587
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📮',
    description: 'Microsoft 365 and Outlook.com accounts',
    popular: true,
    defaultImap: 'outlook.office365.com',
    defaultSmtp: 'smtp.office365.com',
    defaultImapPort: 993,
    defaultSmtpPort: 587
  },
  {
    id: 'imap',
    name: 'Other (IMAP)',
    icon: '📬',
    description: 'Any email provider with IMAP/SMTP support'
  },
  {
    id: 'fastmail',
    name: 'Fastmail',
    icon: '⚡',
    description: 'Fastmail accounts via IMAP',
    defaultImap: 'imap.fastmail.com',
    defaultSmtp: 'smtp.fastmail.com',
    defaultImapPort: 993,
    defaultSmtpPort: 587
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    icon: '🟣',
    description: 'Yahoo Mail accounts via IMAP',
    defaultImap: 'imap.mail.yahoo.com',
    defaultSmtp: 'smtp.mail.yahoo.com',
    defaultImapPort: 993,
    defaultSmtpPort: 587
  },
  {
    id: 'proton',
    name: 'ProtonMail',
    icon: '🔒',
    description: 'ProtonMail via Bridge (requires Bridge setup)',
    defaultImap: '127.0.0.1',
    defaultSmtp: '127.0.0.1',
    defaultImapPort: 1143,
    defaultSmtpPort: 1025
  }
]

const ProviderSelection: React.FC<{
  onSelectProvider: (provider: ProviderInfo) => void
}> = ({ onSelectProvider }) => {
  const popularProviders = providers.filter(p => p.popular)
  const otherProviders = providers.filter(p => !p.popular)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Popular Providers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {popularProviders.map((provider) => (
            <Card
              key={provider.id}
              className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelectProvider(provider)}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{provider.icon}</div>
                <div className="flex-1">
                  <h4 className="font-medium">{provider.name}</h4>
                  <p className="text-sm text-muted-foreground">{provider.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Other Providers</h3>
        <div className="space-y-2">
          {otherProviders.map((provider) => (
            <Card
              key={provider.id}
              className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelectProvider(provider)}
            >
              <div className="flex items-center gap-3">
                <div className="text-xl">{provider.icon}</div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{provider.name}</h4>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}


const CredentialsSetup: React.FC<{
  provider: ProviderInfo
  onBack: () => void
  onSuccess: () => void
}> = ({ provider, onBack, onSuccess }) => {
  const dispatch = useAppDispatch()
  const isLoading = useAppSelector(selectIsLoadingMail)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    imapHost: provider.defaultImap || '',
    imapPort: String(provider.defaultImapPort || 993),
    imapSecure: true,
    smtpHost: provider.defaultSmtp || '',
    smtpPort: String(provider.defaultSmtpPort || 587),
    smtpSecure: true
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }, [errors])

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }
    if (!formData.password.trim()) {
      newErrors.password = 'Password is required'
    }
    if (provider.id === 'imap') {
      if (!formData.imapHost.trim()) {
        newErrors.imapHost = 'IMAP server is required'
      }
      if (!formData.smtpHost.trim()) {
        newErrors.smtpHost = 'SMTP server is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      // Use simple email + password - the backend handles provider detection
      const accountData = {
        email: formData.email,
        password: formData.password,
        displayName: formData.email // Simple display name
      }

      await dispatch(addMailAccount(accountData)).unwrap()
      onSuccess()
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to add account'
      })
    }
  }, [dispatch, formData, provider.id, validateForm, onSuccess])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{provider.icon}</div>
        <h3 className="text-lg font-semibold">Add {provider.name} Account</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your email and password - just like Apple Mail
        </p>
      </div>

      <div className="space-y-4">

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email Address
          </label>
          <Input
            id="email"
            type="email"
            placeholder="your.email@example.com"
            value={formData.email}
            onChange={(value) => handleInputChange('email', value)}
            error={errors.email}
            leftIcon={<Mail className="h-4 w-4" />}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Password
          </label>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Your email password"
            value={formData.password}
            onChange={(value) => handleInputChange('password', value)}
            error={errors.password}
            rightIcon={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            }
          />
        </div>

        {/* Only show advanced settings for "Other" providers */}
        {provider.id === 'imap' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="imapHost" className="block text-sm font-medium mb-2">
                  IMAP Server
                </label>
                <Input
                  id="imapHost"
                  type="text"
                  placeholder="imap.example.com"
                  value={formData.imapHost}
                  onChange={(value) => handleInputChange('imapHost', value)}
                  error={errors.imapHost}
                />
              </div>
              <div>
                <label htmlFor="imapPort" className="block text-sm font-medium mb-2">
                  IMAP Port
                </label>
                <Input
                  id="imapPort"
                  type="number"
                  value={formData.imapPort}
                  onChange={(value) => handleInputChange('imapPort', value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="smtpHost" className="block text-sm font-medium mb-2">
                  SMTP Server
                </label>
                <Input
                  id="smtpHost"
                  type="text"
                  placeholder="smtp.example.com"
                  value={formData.smtpHost}
                  onChange={(value) => handleInputChange('smtpHost', value)}
                  error={errors.smtpHost}
                />
              </div>
              <div>
                <label htmlFor="smtpPort" className="block text-sm font-medium mb-2">
                  SMTP Port
                </label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={formData.smtpPort}
                  onChange={(value) => handleInputChange('smtpPort', value)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {errors.submit && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Setup Error</span>
          </div>
          <p className="text-sm text-destructive/80 mt-1">{errors.submit}</p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding Account...
            </>
          ) : (
            'Add Account'
          )}
        </Button>
      </div>
    </form>
  )
}

const SuccessStep: React.FC<{
  provider: ProviderInfo
  onClose: () => void
}> = ({ provider, onClose }) => {
  return (
    <div className="text-center space-y-6">
      <div>
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Account Added Successfully!</h3>
        <p className="text-sm text-muted-foreground">
          Your {provider.name} account has been connected and will start syncing shortly.
        </p>
      </div>

      <Button onClick={onClose} className="w-full">
        Get Started
      </Button>
    </div>
  )
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  className
}) => {
  const [step, setStep] = useState<SetupStep>('provider')
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null)

  // Add ESC key handling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSelectProvider = useCallback((provider: ProviderInfo) => {
    setSelectedProvider(provider)
    setStep('credentials')
  }, [])

  const handleBack = useCallback(() => {
    setStep('provider')
    setSelectedProvider(null)
  }, [])

  const handleSuccess = useCallback(() => {
    setStep('success')
  }, [])

  const handleClose = useCallback(() => {
    setStep('provider')
    setSelectedProvider(null)
    onClose()
  }, [onClose])

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }, [handleClose])

  if (!isOpen) return null

  const getStepTitle = () => {
    switch (step) {
      case 'provider': return 'Add Mail Account'
      case 'credentials': return 'Account Setup'
      case 'success': return 'Success!'
      default: return 'Add Account'
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <Card className={cn('w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border', className)} onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="modal-title" className="text-xl font-semibold">{getStepTitle()}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-[400px]">
            {step === 'provider' && (
              <ProviderSelection onSelectProvider={handleSelectProvider} />
            )}
            
            {step === 'credentials' && selectedProvider && (
              <CredentialsSetup
                provider={selectedProvider}
                onBack={handleBack}
                onSuccess={handleSuccess}
              />
            )}
            
            {step === 'success' && selectedProvider && (
              <SuccessStep
                provider={selectedProvider}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}