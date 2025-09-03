import React, { useState } from 'react'
import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Keyboard,
  Mouse,
  Contrast,
  Zap,
  ZapOff,
  Type,
  Minus,
  Plus,
  RotateCcw,
  Settings,
  Palette,
  Focus
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'
import { cn } from '../ui/utils'
import { useAccessibility } from '../../contexts/AccessibilityContext'
import {
  useHighContrast,
  useReducedMotion,
  useTextScaling,
  useColorAccessibility,
  useVoiceNavigation,
  useKeyboardOnly,
  useEnhancedFocus,
  useScreenReader
} from '../../hooks/useAccessibility'

interface AccessibilitySettingsProps {
  isOpen?: boolean
  onClose?: () => void
  className?: string
}

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({
  isOpen = true,
  onClose,
  className
}) => {
  const { settings, actions } = useAccessibility()
  const { isHighContrast, toggleHighContrast } = useHighContrast()
  const { prefersReducedMotion, toggleReducedMotion } = useReducedMotion()
  const { textScale, increaseTextSize, decreaseTextSize, resetTextSize } = useTextScaling()
  const { colorBlindnessMode, setColorBlindnessMode } = useColorAccessibility()
  const { isVoiceNavigationEnabled, toggleVoiceNavigation, isListening } = useVoiceNavigation()
  const { isKeyboardOnly, toggleKeyboardOnly } = useKeyboardOnly()
  const { isEnhancedFocus } = useEnhancedFocus()
  const { announce } = useScreenReader()

  const [activeSection, setActiveSection] = useState<string>('vision')

  const sections = [
    { id: 'vision', label: 'Vision', icon: Eye },
    { id: 'motion', label: 'Motion', icon: Zap },
    { id: 'interaction', label: 'Interaction', icon: Mouse },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'advanced', label: 'Advanced', icon: Settings }
  ]

  const colorBlindnessOptions = [
    { value: 'none', label: 'No filter', description: 'Normal color vision' },
    { value: 'protanopia', label: 'Protanopia', description: 'Red color blindness' },
    { value: 'deuteranopia', label: 'Deuteranopia', description: 'Green color blindness' },
    { value: 'tritanopia', label: 'Tritanopia', description: 'Blue color blindness' },
    { value: 'achromatopsia', label: 'Achromatopsia', description: 'Complete color blindness' }
  ] as const

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId)
    announce(`Switched to ${sections.find(s => s.id === sectionId)?.label} settings`, 'polite')
  }

  const handleColorBlindnessChange = (value: typeof colorBlindnessOptions[number]['value']) => {
    setColorBlindnessMode(value)
    const option = colorBlindnessOptions.find(opt => opt.value === value)
    announce(`Color blindness filter set to ${option?.label}`, 'polite')
  }

  if (!isOpen) return null

  return (
    <Card className={cn('w-full max-w-4xl mx-auto', className)}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Accessibility Settings
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Customize Flow Desk to meet your accessibility needs
            </p>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close accessibility settings"
            >
              ×
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Navigation */}
          <nav className="lg:w-48" role="tablist" aria-label="Accessibility settings sections">
            <div className="space-y-1">
              {sections.map((section) => {
                const IconComponent = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors',
                      'hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-primary',
                      activeSection === section.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground'
                    )}
                    role="tab"
                    aria-selected={activeSection === section.id}
                    aria-controls={`${section.id}-panel`}
                  >
                    <IconComponent className="h-4 w-4" aria-hidden="true" />
                    {section.label}
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1">
            {/* Vision Settings */}
            {activeSection === 'vision' && (
              <div role="tabpanel" id="vision-panel" className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Vision Settings</h3>

                {/* High Contrast */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        High Contrast Mode
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Increases contrast for better visibility
                      </p>
                    </div>
                    <Button
                      variant={isHighContrast ? 'primary' : 'outline'}
                      size="sm"
                      onClick={toggleHighContrast}
                      aria-label={`${isHighContrast ? 'Disable' : 'Enable'} high contrast mode`}
                      aria-pressed={isHighContrast}
                    >
                      <Contrast className="h-4 w-4" aria-hidden="true" />
                      {isHighContrast ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>

                {/* Enhanced Focus */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Enhanced Focus Indicators
                      </label>
                      <p className="text-xs text-muted-foreground">
                        More visible focus outlines for keyboard navigation
                      </p>
                    </div>
                    <Button
                      variant={isEnhancedFocus ? 'primary' : 'outline'}
                      size="sm"
                      onClick={actions.toggleEnhancedFocus}
                      aria-label={`${isEnhancedFocus ? 'Disable' : 'Enable'} enhanced focus indicators`}
                      aria-pressed={isEnhancedFocus}
                    >
                      <Focus className="h-4 w-4" aria-hidden="true" />
                      {isEnhancedFocus ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>

                {/* Text Scaling */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Text Size
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Adjust text size for better readability
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={decreaseTextSize}
                      disabled={textScale <= 0.75}
                      aria-label="Decrease text size"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <span className="min-w-16 text-center text-sm font-mono">
                      {Math.round(textScale * 100)}%
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={increaseTextSize}
                      disabled={textScale >= 2.0}
                      aria-label="Increase text size"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetTextSize}
                      aria-label="Reset text size to default"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Reset
                    </Button>
                  </div>
                </div>

                {/* Color Blindness Support */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Color Vision Support
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Adjust colors for different types of color vision
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {colorBlindnessOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleColorBlindnessChange(option.value)}
                        className={cn(
                          'p-3 text-left rounded-md border transition-colors',
                          'hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-primary',
                          colorBlindnessMode === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border'
                        )}
                        role="radio"
                        aria-checked={colorBlindnessMode === option.value}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-4 h-4 rounded-full border-2',
                            colorBlindnessMode === option.value
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          )} aria-hidden="true" />
                          <div>
                            <div className="text-sm font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Motion Settings */}
            {activeSection === 'motion' && (
              <div role="tabpanel" id="motion-panel" className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Motion Settings</h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Reduce Motion
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Minimize animations and transitions
                      </p>
                    </div>
                    <Button
                      variant={prefersReducedMotion ? 'primary' : 'outline'}
                      size="sm"
                      onClick={toggleReducedMotion}
                      aria-label={`${prefersReducedMotion ? 'Disable' : 'Enable'} reduced motion`}
                      aria-pressed={prefersReducedMotion}
                    >
                      {prefersReducedMotion ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                      {prefersReducedMotion ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Interaction Settings */}
            {activeSection === 'interaction' && (
              <div role="tabpanel" id="interaction-panel" className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Interaction Settings</h3>

                {/* Keyboard Only Mode */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Keyboard-Only Navigation
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Navigate using only keyboard input
                      </p>
                    </div>
                    <Button
                      variant={isKeyboardOnly ? 'primary' : 'outline'}
                      size="sm"
                      onClick={toggleKeyboardOnly}
                      aria-label={`${isKeyboardOnly ? 'Disable' : 'Enable'} keyboard-only navigation`}
                      aria-pressed={isKeyboardOnly}
                    >
                      <Keyboard className="h-4 w-4" aria-hidden="true" />
                      {isKeyboardOnly ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>

                {/* Sticky Keys */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Sticky Keys
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Press modifier keys one at a time for key combinations
                      </p>
                    </div>
                    <Button
                      variant={settings.stickyKeys ? 'primary' : 'outline'}
                      size="sm"
                      onClick={actions.toggleStickyKeys}
                      aria-label={`${settings.stickyKeys ? 'Disable' : 'Enable'} sticky keys`}
                      aria-pressed={settings.stickyKeys}
                    >
                      <Keyboard className="h-4 w-4" aria-hidden="true" />
                      {settings.stickyKeys ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Audio Settings */}
            {activeSection === 'audio' && (
              <div role="tabpanel" id="audio-panel" className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Audio Settings</h3>

                {/* Screen Reader Support */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Screen Reader Support
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Enhanced announcements for screen readers
                      </p>
                    </div>
                    <Button
                      variant={settings.screenReader ? 'primary' : 'outline'}
                      size="sm"
                      onClick={actions.toggleScreenReader}
                      aria-label={`${settings.screenReader ? 'Disable' : 'Enable'} screen reader support`}
                      aria-pressed={settings.screenReader}
                    >
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                      {settings.screenReader ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>

                {/* Voice Navigation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Voice Navigation
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Control the app with voice commands
                        {isListening && <span className="text-primary"> • Listening</span>}
                      </p>
                    </div>
                    <Button
                      variant={isVoiceNavigationEnabled ? 'primary' : 'outline'}
                      size="sm"
                      onClick={toggleVoiceNavigation}
                      aria-label={`${isVoiceNavigationEnabled ? 'Disable' : 'Enable'} voice navigation`}
                      aria-pressed={isVoiceNavigationEnabled}
                    >
                      {isVoiceNavigationEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                      {isVoiceNavigationEnabled ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>

                {/* Sound Feedback */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Sound Feedback
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Audio cues for interactions and status changes
                      </p>
                    </div>
                    <Button
                      variant={settings.soundFeedback ? 'primary' : 'outline'}
                      size="sm"
                      onClick={actions.toggleSoundFeedback}
                      aria-label={`${settings.soundFeedback ? 'Disable' : 'Enable'} sound feedback`}
                      aria-pressed={settings.soundFeedback}
                    >
                      {settings.soundFeedback ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      {settings.soundFeedback ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            {activeSection === 'advanced' && (
              <div role="tabpanel" id="advanced-panel" className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Advanced Settings</h3>

                {/* Reset to Defaults */}
                <div className="p-4 border border-border rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Reset Settings
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Reset all accessibility settings to their defaults
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        actions.resetToDefaults()
                        announce('All accessibility settings reset to defaults', 'assertive')
                      }}
                      aria-label="Reset all accessibility settings to defaults"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Reset All
                    </Button>
                  </div>
                </div>

                {/* Load System Preferences */}
                <div className="p-4 border border-border rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        System Preferences
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Load accessibility settings from your operating system
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        actions.loadFromSystem()
                        announce('System accessibility preferences loaded', 'polite')
                      }}
                      aria-label="Load system accessibility preferences"
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      Load System
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="mt-8 p-4 bg-muted/50 rounded-md">
          <h4 className="text-sm font-medium text-foreground mb-2">Keyboard Shortcuts</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Ctrl/Cmd + Alt + H: Toggle High Contrast</div>
            <div>Ctrl/Cmd + Alt + R: Toggle Reduced Motion</div>
            <div>Ctrl/Cmd + Alt + K: Toggle Keyboard Mode</div>
            <div>Ctrl/Cmd + Alt + V: Toggle Voice Navigation</div>
            <div>Ctrl/Cmd + Alt + +/-: Adjust Text Size</div>
            <div>Ctrl/Cmd + Alt + 0: Reset Text Size</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default AccessibilitySettings