import React, { useState, useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../../store'
import { setThemeMode, setAccentColor, setFontSize, setAnimations } from '../../store/slices/themeSlice'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  cn,
  Settings,
  Palette,
  User,
  Shield,
  Bell,
  Sliders,
  Globe,
  Keyboard,
  Monitor,
  ChevronRight,
  Check,
  Sun,
  Moon,
  Laptop
} from '../ui'
import { type BaseComponentProps } from '../ui/types'

interface SettingCategory {
  id: string
  label: string
  icon: React.ReactNode
  description?: string
}

const settingCategories: SettingCategory[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: <Palette className="h-5 w-5" />,
    description: 'Theme, colors, and visual preferences'
  },
  {
    id: 'general',
    label: 'General',
    icon: <Settings className="h-5 w-5" />,
    description: 'Basic app settings and preferences'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell className="h-5 w-5" />,
    description: 'Manage alerts and notification preferences'
  },
  {
    id: 'privacy',
    label: 'Privacy & Security',
    icon: <Shield className="h-5 w-5" />,
    description: 'Data protection and security settings'
  },
  {
    id: 'keyboard',
    label: 'Keyboard Shortcuts',
    icon: <Keyboard className="h-5 w-5" />,
    description: 'Customize keyboard shortcuts'
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: <Sliders className="h-5 w-5" />,
    description: 'Developer and advanced user settings'
  }
]

interface SettingSectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
)

interface SettingItemProps {
  label: string
  description?: string
  children: React.ReactNode
}

const SettingItem: React.FC<SettingItemProps> = ({ label, description, children }) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
    <div className="flex-1 pr-4">
      <div className="font-medium">{label}</div>
      {description && (
        <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
      )}
    </div>
    <div className="flex-shrink-0">
      {children}
    </div>
  </div>
)

const AppearanceSettings: React.FC = () => {
  const dispatch = useAppDispatch()
  const theme = useAppSelector(state => state.theme)

  const themeOptions = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Laptop className="h-4 w-4" /> }
  ]

  const accentColors = [
    '#0ea5e9', // blue
    '#10b981', // green
    '#f59e0b', // yellow
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16'  // lime
  ]

  const fontSizes = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' }
  ]

  return (
    <div className="space-y-8">
      <SettingSection
        title="Theme"
        description="Choose how Flow Desk looks to you"
      >
        <SettingItem label="Color Mode">
          <div className="flex gap-2">
            {themeOptions.map(option => (
              <Button
                key={option.value}
                size="sm"
                variant={theme.mode === option.value ? 'secondary' : 'outline'}
                onClick={() => dispatch(setThemeMode(option.value as any))}
                leftIcon={option.icon}
                className="min-w-[100px]"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </SettingItem>

        <SettingItem label="Accent Color">
          <div className="flex gap-2">
            {accentColors.map(color => (
              <button
                key={color}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-all',
                  theme.accentColor === color
                    ? 'border-foreground scale-110'
                    : 'border-border hover:border-muted-foreground'
                )}
                style={{ backgroundColor: color }}
                onClick={() => dispatch(setAccentColor(color))}
                title={color}
              >
                {theme.accentColor === color && (
                  <Check className="h-4 w-4 text-white m-auto" />
                )}
              </button>
            ))}
          </div>
        </SettingItem>

        <SettingItem label="Font Size">
          <div className="flex gap-2">
            {fontSizes.map(size => (
              <Button
                key={size.value}
                size="sm"
                variant={theme.fontSize === size.value ? 'secondary' : 'outline'}
                onClick={() => dispatch(setFontSize(size.value as any))}
                className="min-w-[80px]"
              >
                {size.label}
              </Button>
            ))}
          </div>
        </SettingItem>

        <SettingItem
          label="Animations"
          description="Enable smooth transitions and animations"
        >
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={theme.animations}
              onChange={(e) => dispatch(setAnimations(e.target.checked))}
              className="rounded border-border"
            />
            <span className="text-sm">Enable</span>
          </label>
        </SettingItem>
      </SettingSection>
    </div>
  )
}

const GeneralSettings: React.FC = () => {
  return (
    <div className="space-y-8">
      <SettingSection
        title="Startup"
        description="Configure how Flow Desk starts up"
      >
        <SettingItem
          label="Launch at startup"
          description="Automatically start Flow Desk when you log in"
        >
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={false}
              className="rounded border-border"
            />
            <span className="text-sm">Enable</span>
          </label>
        </SettingItem>

        <SettingItem
          label="Start minimized"
          description="Start Flow Desk in the background"
        >
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={false}
              className="rounded border-border"
            />
            <span className="text-sm">Enable</span>
          </label>
        </SettingItem>
      </SettingSection>

      <SettingSection
        title="Language & Region"
        description="Set your preferred language and regional settings"
      >
        <SettingItem label="Language">
          <select className="px-3 py-2 border border-border rounded-md bg-background min-w-[120px]">
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </SettingItem>

        <SettingItem label="Date Format">
          <select className="px-3 py-2 border border-border rounded-md bg-background min-w-[120px]">
            <option value="mdy">MM/DD/YYYY</option>
            <option value="dmy">DD/MM/YYYY</option>
            <option value="ymd">YYYY-MM-DD</option>
          </select>
        </SettingItem>

        <SettingItem label="Time Format">
          <select className="px-3 py-2 border border-border rounded-md bg-background min-w-[120px]">
            <option value="12">12 Hour</option>
            <option value="24">24 Hour</option>
          </select>
        </SettingItem>
      </SettingSection>
    </div>
  )
}

const NotificationSettings: React.FC = () => {
  return (
    <div className="space-y-8">
      <SettingSection
        title="Desktop Notifications"
        description="Control how and when you receive notifications"
      >
        <SettingItem
          label="Show notifications"
          description="Display desktop notifications for new messages and events"
        >
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={true}
              className="rounded border-border"
            />
            <span className="text-sm">Enable</span>
          </label>
        </SettingItem>

        <SettingItem
          label="Notification sounds"
          description="Play sounds for notifications"
        >
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={true}
              className="rounded border-border"
            />
            <span className="text-sm">Enable</span>
          </label>
        </SettingItem>

        <SettingItem
          label="Notification preview"
          description="Show message content in notifications"
        >
          <select className="px-3 py-2 border border-border rounded-md bg-background min-w-[140px]">
            <option value="full">Full content</option>
            <option value="partial">Name and subject only</option>
            <option value="none">Name only</option>
          </select>
        </SettingItem>
      </SettingSection>

      <SettingSection
        title="Email Notifications"
        description="Configure email-specific notification settings"
      >
        <SettingItem
          label="New message notifications"
          description="Get notified when new emails arrive"
        >
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={true}
              className="rounded border-border"
            />
            <span className="text-sm">Enable</span>
          </label>
        </SettingItem>

        <SettingItem
          label="VIP notifications"
          description="Special notifications for important contacts"
        >
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={true}
              className="rounded border-border"
            />
            <span className="text-sm">Enable</span>
          </label>
        </SettingItem>
      </SettingSection>
    </div>
  )
}

interface SettingsCategoryListProps {
  categories: SettingCategory[]
  selectedCategory: string
  onCategorySelect: (categoryId: string) => void
}

const SettingsCategoryList: React.FC<SettingsCategoryListProps> = ({
  categories,
  selectedCategory,
  onCategorySelect
}) => {
  return (
    <div className="space-y-1">
      {categories.map(category => (
        <Button
          key={category.id}
          variant={selectedCategory === category.id ? 'secondary' : 'ghost'}
          className="w-full justify-start gap-3 h-auto py-3 px-3 text-left"
          onClick={() => onCategorySelect(category.id)}
        >
          <div className="flex-shrink-0">
            {category.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{category.label}</div>
            {category.description && (
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {category.description}
              </div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      ))}
    </div>
  )
}

export interface SettingsPanelsProps extends BaseComponentProps {
  initialCategory?: string
  onClose?: () => void
}

export const SettingsPanels: React.FC<SettingsPanelsProps> = ({
  initialCategory = 'appearance',
  onClose,
  className,
  'data-testid': testId
}) => {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)

  const renderSettingsContent = useCallback(() => {
    switch (selectedCategory) {
      case 'appearance':
        return <AppearanceSettings />
      case 'general':
        return <GeneralSettings />
      case 'notifications':
        return <NotificationSettings />
      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Privacy & Security
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Local-First Data Processing</label>
                  <p className="text-xs text-muted-foreground">All email and calendar data processed locally</p>
                </div>
                <div className="text-green-600 text-sm">✓ Enabled</div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">End-to-End Encryption</label>
                  <p className="text-xs text-muted-foreground">Configuration sync uses E2E encryption</p>
                </div>
                <div className="text-green-600 text-sm">✓ Enabled</div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Browser Session Isolation</label>
                  <p className="text-xs text-muted-foreground">Each workspace has isolated browser sessions</p>
                </div>
                <div className="text-green-600 text-sm">✓ Enabled</div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Credential Storage</label>
                  <p className="text-xs text-muted-foreground">Stored securely in OS keychain</p>
                </div>
                <div className="text-green-600 text-sm">✓ Secure</div>
              </div>
            </div>
          </div>
        )
      case 'keyboard':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Keyboard className="h-5 w-5 mr-2" />
                Keyboard Shortcuts
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Navigation</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded">
                    <span className="text-sm">Switch to Mail</span>
                    <kbd className="px-2 py-1 bg-background border rounded text-xs">⌘ 1</kbd>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded">
                    <span className="text-sm">Switch to Calendar</span>
                    <kbd className="px-2 py-1 bg-background border rounded text-xs">⌘ 2</kbd>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded">
                    <span className="text-sm">New Workspace</span>
                    <kbd className="px-2 py-1 bg-background border rounded text-xs">⌘ ⇧ N</kbd>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Mail</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded">
                    <span className="text-sm">Compose New Email</span>
                    <kbd className="px-2 py-1 bg-background border rounded text-xs">⌘ N</kbd>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded">
                    <span className="text-sm">Reply</span>
                    <kbd className="px-2 py-1 bg-background border rounded text-xs">⌘ R</kbd>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded">
                    <span className="text-sm">Forward</span>
                    <kbd className="px-2 py-1 bg-background border rounded text-xs">⌘ ⇧ F</kbd>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm">General</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded">
                    <span className="text-sm">Search</span>
                    <kbd className="px-2 py-1 bg-background border rounded text-xs">⌘ K</kbd>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded">
                    <span className="text-sm">Preferences</span>
                    <kbd className="px-2 py-1 bg-background border rounded text-xs">⌘ ,</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      case 'advanced':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Sliders className="h-5 w-5 mr-2" />
                Advanced Settings
              </h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-sm mb-3">Performance</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Memory Usage Limit</label>
                      <p className="text-xs text-muted-foreground">Maximum memory per workspace</p>
                    </div>
                    <select className="px-3 py-1 border rounded text-sm">
                      <option>512 MB</option>
                      <option>1 GB</option>
                      <option>2 GB</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Hardware Acceleration</label>
                      <p className="text-xs text-muted-foreground">Use GPU for rendering</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-3">Developer</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Debug Mode</label>
                      <p className="text-xs text-muted-foreground">Enable debug logging</p>
                    </div>
                    <input type="checkbox" className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">DevTools</label>
                      <p className="text-xs text-muted-foreground">Open developer tools on startup</p>
                    </div>
                    <input type="checkbox" className="rounded" />
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-3">Data</h4>
                <div className="space-y-3">
                  <Button variant="outline" size="sm">
                    Export Configuration
                  </Button>
                  <Button variant="outline" size="sm">
                    Import Configuration
                  </Button>
                  <Button variant="destructive" size="sm">
                    Reset All Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      default:
        return <AppearanceSettings />
    }
  }, [selectedCategory])

  return (
    <div className={cn('flex h-full bg-background', className)} data-testid={testId}>
      {/* Settings Categories Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <h2 className="font-semibold text-lg">Settings</h2>
            </div>
            {onClose && (
              <Button size="sm" variant="ghost" onClick={onClose}>
                ×
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <SettingsCategoryList
            categories={settingCategories}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
          />
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">
              {settingCategories.find(c => c.id === selectedCategory)?.label}
            </h1>
            <p className="text-muted-foreground">
              {settingCategories.find(c => c.id === selectedCategory)?.description}
            </p>
          </div>

          {renderSettingsContent()}
        </div>
      </div>
    </div>
  )
}