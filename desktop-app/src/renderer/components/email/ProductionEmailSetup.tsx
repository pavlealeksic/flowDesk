/**
 * Production Email Setup Component
 * 
 * Provides a professional email setup interface with:
 * - Automatic server detection for Gmail and Outlook
 * - Direct IMAP/SMTP authentication
 * - Real-time validation and testing
 * - Professional UI/UX
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Mail, 
  Lock, 
  User, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff,
  Server,
  Shield,
  Zap
} from 'lucide-react'

import { 
  EmailCredentials, 
  AccountSetupResult, 
  ValidationResult, 
  ServerConfig,
  AccountSetupState 
} from '../../types/email'

interface ProductionEmailSetupProps {
  onAccountSetup?: (result: AccountSetupResult) => void
  onCancel?: () => void
}

declare global {
  interface Window {
    flowDesk: {
      productionEmail: {
        setupAccount(userId: string, credentials: EmailCredentials): Promise<AccountSetupResult>
        testEmailSetup(credentials: EmailCredentials): Promise<ValidationResult>
        getServerConfig(email: string): Promise<ServerConfig>
      }
    }
  }
}

const ProductionEmailSetup: React.FC<ProductionEmailSetupProps> = ({
  onAccountSetup,
  onCancel
}) => {
  // State management
  const [state, setState] = useState<AccountSetupState>({
    step: 'credentials',
    email: '',
    provider: undefined,
    serverConfig: undefined,
    validationResult: undefined,
    setupResult: undefined,
    error: undefined,
    isLoading: false
  })

  const [credentials, setCredentials] = useState<EmailCredentials>({
    email: '',
    password: '',
    displayName: '',
    providerOverride: undefined
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Auto-detect server configuration when email changes
  useEffect(() => {
    if (credentials.email && credentials.email.includes('@')) {
      detectServerConfig(credentials.email)
    }
  }, [credentials.email])

  const detectServerConfig = async (email: string) => {
    try {
      const config = await window.flowDesk.productionEmail.getServerConfig(email)
      setState(prev => ({
        ...prev,
        provider: detectProvider(email),
        serverConfig: config
      }))
    } catch (error) {
      console.error('Failed to detect server config:', error)
    }
  }

  const detectProvider = (email: string): string => {
    const domain = email.split('@')[1]?.toLowerCase()
    
    if (domain === 'gmail.com' || domain === 'googlemail.com') return 'Gmail'
    if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) return 'Outlook'
    if (['yahoo.com', 'yahoo.co.uk', 'yahoo.fr'].includes(domain)) return 'Yahoo'
    if (['protonmail.com', 'protonmail.ch', 'pm.me'].includes(domain)) return 'ProtonMail'
    if (['fastmail.com', 'fastmail.fm'].includes(domain)) return 'FastMail'
    if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) return 'iCloud'
    
    return 'Custom'
  }

  const requiresAppPassword = (provider: string): boolean => {
    return ['Gmail', 'Yahoo', 'iCloud'].includes(provider)
  }

  const getAppPasswordInstructions = (provider: string): string[] => {
    switch (provider) {
      case 'Gmail':
        return [
          'Go to your Google Account settings',
          'Select Security from the left panel', 
          'Enable 2-Step Verification if not already enabled',
          'Click on "App passwords"',
          'Generate an app password for "Mail"',
          'Use the generated password instead of your regular password'
        ]
      case 'Yahoo':
        return [
          'Go to Yahoo Account Security settings',
          'Turn on 2-step verification',
          'Click "Generate app password"',
          'Select "Other app" and name it',
          'Use the generated password for email setup'
        ]
      case 'iCloud':
        return [
          'Go to Apple ID account page',
          'Sign in with your Apple ID',
          'Go to Security section',
          'Generate an app-specific password',
          'Use this password for email setup'
        ]
      default:
        return ['Check your email provider\'s documentation for app password setup']
    }
  }

  const handleTestConnection = async () => {
    if (!credentials.email || !credentials.password) {
      setState(prev => ({ ...prev, error: 'Please enter email and password' }))
      return
    }

    setState(prev => ({ ...prev, step: 'validation', isLoading: true, error: undefined }))

    try {
      const result = await window.flowDesk.productionEmail.testEmailSetup(credentials)
      
      setState(prev => ({
        ...prev,
        validationResult: result,
        isLoading: false,
        step: result.isValid ? 'testing' : 'error',
        error: result.isValid ? undefined : result.errorMessage
      }))

      if (result.isValid) {
        // Proceed to actual setup
        setTimeout(() => setupAccount(), 1000)
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        step: 'error',
        error: error instanceof Error ? error.message : 'Connection test failed'
      }))
    }
  }

  const setupAccount = async () => {
    setState(prev => ({ ...prev, step: 'testing', isLoading: true }))

    try {
      const userId = 'default-user' // In real app, get from auth context
      const result = await window.flowDesk.productionEmail.setupAccount(userId, credentials)
      
      setState(prev => ({
        ...prev,
        setupResult: result,
        isLoading: false,
        step: 'complete'
      }))

      if (onAccountSetup) {
        onAccountSetup(result)
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        step: 'error',
        error: error instanceof Error ? error.message : 'Account setup failed'
      }))
    }
  }

  const handleRetry = () => {
    setState(prev => ({
      ...prev,
      step: 'credentials',
      error: undefined,
      validationResult: undefined,
      setupResult: undefined,
      isLoading: false
    }))
  }

  const renderStepIndicator = () => {
    const steps = [
      { id: 'credentials', label: 'Credentials', icon: User },
      { id: 'validation', label: 'Validation', icon: Shield },
      { id: 'testing', label: 'Testing', icon: Settings },
      { id: 'complete', label: 'Complete', icon: CheckCircle }
    ]

    const currentStepIndex = steps.findIndex(step => step.id === state.step)

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = index <= currentStepIndex
          const isCurrent = index === currentStepIndex
          
          return (
            <React.Fragment key={step.id}>
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                ${isActive 
                  ? 'border-blue-500 bg-blue-500 text-white' 
                  : 'border-gray-300 bg-white text-gray-400'
                }
                ${isCurrent ? 'ring-4 ring-blue-200' : ''}
              `}>
                {state.isLoading && isCurrent ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`
                  w-16 h-0.5 mx-2 transition-all
                  ${isActive ? 'bg-blue-500' : 'bg-gray-300'}
                `} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  const renderCredentialsStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Email Account</h2>
        <p className="text-gray-600">Enter your email credentials for professional-grade IMAP/SMTP setup</p>
      </div>

      {/* Email Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="email"
            value={credentials.email}
            onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>
        {state.provider && (
          <div className="mt-2 flex items-center space-x-2 text-sm">
            <Server className="w-4 h-4 text-green-500" />
            <span className="text-green-600">Detected: {state.provider}</span>
          </div>
        )}
      </div>

      {/* Password Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password {state.provider && requiresAppPassword(state.provider) && (
            <span className="text-orange-600 font-medium">(App Password Required)</span>
          )}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={credentials.password}
            onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {state.provider && requiresAppPassword(state.provider) && (
          <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">App Password Required</span>
            </div>
            <div className="text-sm text-orange-700 space-y-1">
              {getAppPasswordInstructions(state.provider).map((instruction, index) => (
                <div key={index}>• {instruction}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Display Name Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Display Name (Optional)
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={credentials.displayName}
            onChange={(e) => setCredentials(prev => ({ ...prev, displayName: e.target.value }))}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your Name"
          />
        </div>
      </div>

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <Settings className="w-4 h-4" />
          <span>Advanced Options</span>
        </button>
        
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4 border-t border-gray-200 pt-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider Override
                </label>
                <select
                  value={credentials.providerOverride || ''}
                  onChange={(e) => setCredentials(prev => ({ 
                    ...prev, 
                    providerOverride: e.target.value || undefined 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Auto-detect</option>
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook/Hotmail</option>
                  <option value="yahoo">Yahoo Mail</option>
                  <option value="fastmail">FastMail</option>
                  <option value="icloud">iCloud Mail</option>
                  <option value="custom">Custom IMAP</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Server Configuration Display */}
      {state.serverConfig && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Server Configuration</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800">IMAP:</span>
              <div className="text-blue-700">
                {state.serverConfig.imapHost}:{state.serverConfig.imapPort}
                <span className="ml-2 text-xs bg-blue-200 px-1 rounded">
                  {state.serverConfig.imapSecurity}
                </span>
              </div>
            </div>
            <div>
              <span className="font-medium text-blue-800">SMTP:</span>
              <div className="text-blue-700">
                {state.serverConfig.smtpHost}:{state.serverConfig.smtpPort}
                <span className="ml-2 text-xs bg-blue-200 px-1 rounded">
                  {state.serverConfig.smtpSecurity}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          onClick={handleTestConnection}
          disabled={!credentials.email || !credentials.password || state.isLoading}
          className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Zap className="w-5 h-5" />
          )}
          <span>Test & Setup Account</span>
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </motion.div>
  )

  const renderProcessingStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6"
    >
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <Mail className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-600" />
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {state.step === 'validation' && 'Validating Credentials...'}
          {state.step === 'testing' && 'Setting Up Account...'}
        </h3>
        <p className="text-gray-600">
          {state.step === 'validation' && 'Testing IMAP and SMTP connections'}
          {state.step === 'testing' && 'Configuring your email account with secure credential storage'}
        </p>
      </div>

      {state.validationResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-center space-x-2 text-green-800">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Connection Test Successful</span>
          </div>
          <div className="mt-2 text-sm text-green-700 space-y-1">
            <div>✓ IMAP connection verified</div>
            <div>✓ SMTP connection verified</div>
            <div>✓ Authentication method: {state.validationResult.authMethod}</div>
          </div>
        </div>
      )}
    </motion.div>
  )

  const renderCompleteStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6"
    >
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Account Setup Complete!</h3>
        <p className="text-gray-600">Your email account has been configured successfully</p>
      </div>

      {state.setupResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-left">
          <h4 className="font-semibold text-green-900 mb-3">Account Details</h4>
          <div className="space-y-2 text-sm">
            <div><strong>Email:</strong> {state.setupResult.email}</div>
            <div><strong>Provider:</strong> {state.setupResult.provider}</div>
            <div><strong>Display Name:</strong> {state.setupResult.displayName}</div>
            <div><strong>Auth Method:</strong> {state.setupResult.authMethodUsed}</div>
            <div><strong>Account ID:</strong> <code className="text-xs bg-gray-100 px-1 rounded">{state.setupResult.accountId}</code></div>
          </div>

          {state.setupResult.requiresAppPassword && (
            <div className="mt-3 p-2 bg-orange-100 border border-orange-200 rounded text-orange-800 text-xs">
              <strong>Note:</strong> This account uses app password authentication for enhanced security.
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => onAccountSetup && onAccountSetup(state.setupResult!)}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Continue to Email
      </button>
    </motion.div>
  )

  const renderErrorStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6"
    >
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Setup Failed</h3>
        <p className="text-gray-600">There was an issue setting up your email account</p>
      </div>

      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{state.error}</p>
          
          {state.validationResult?.serverSuggestions && (
            <div className="mt-3">
              <h5 className="font-medium text-red-900 mb-2">Suggestions:</h5>
              <ul className="text-xs text-red-700 space-y-1">
                {state.validationResult.serverSuggestions.map((suggestion, index) => (
                  <li key={index}>• {suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={handleRetry}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </motion.div>
  )

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
      {renderStepIndicator()}
      
      <AnimatePresence mode="wait">
        {state.step === 'credentials' && renderCredentialsStep()}
        {(state.step === 'validation' || state.step === 'testing') && renderProcessingStep()}
        {state.step === 'complete' && renderCompleteStep()}
        {state.step === 'error' && renderErrorStep()}
      </AnimatePresence>
    </div>
  )
}

export default ProductionEmailSetup