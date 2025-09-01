import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  Button,
  Card,
  Input,
  cn,
  X,
  Plus,
  Edit,
  Trash2,
  Settings,
  Filter,
} from '../ui'

interface EmailRulesModalProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

interface EmailRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  conditions: string
  actions: string
  appliedCount: number
}

export const EmailRulesModal: React.FC<EmailRulesModalProps> = ({
  isOpen,
  onClose,
  className
}) => {
  const [rules, setRules] = useState<EmailRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load rules when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRules()
    }
  }, [isOpen])

  const loadRules = useCallback(async () => {
    try {
      setIsLoading(true)
      if (window.flowDesk?.mail) {
        // This would call the email rules backend
        const rulesData = await window.flowDesk.mail.getAllRules?.() || []
        setRules(rulesData)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load rules')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleToggleRule = useCallback(async (ruleId: string, enabled: boolean) => {
    try {
      if (window.flowDesk?.mail) {
        await window.flowDesk.mail.updateRule?.(ruleId, { enabled })
        setRules(prev => prev.map(rule => 
          rule.id === ruleId ? { ...rule, enabled } : rule
        ))
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update rule')
    }
  }, [])

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    try {
      if (window.flowDesk?.mail) {
        await window.flowDesk.mail.deleteRule?.(ruleId)
        setRules(prev => prev.filter(rule => rule.id !== ruleId))
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete rule')
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className={cn('w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border', className)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Email Rules
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Automate email management with custom rules and filters
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Rules List Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Active Rules ({rules.filter(r => r.enabled).length})</span>
                <span className="text-xs text-muted-foreground">
                  {rules.length} total rules
                </span>
              </div>
              <Button size="sm" onClick={() => {/* TODO: Add new rule */}}>
                <Plus className="h-4 w-4 mr-2" />
                New Rule
              </Button>
            </div>

            {/* Rules List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading rules...</p>
                </div>
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-12">
                <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Email Rules</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create rules to automatically organize your emails
                </p>
                <Button onClick={() => {/* TODO: Add new rule */}}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Rule
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <Card key={rule.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                            className="rounded"
                          />
                          <div>
                            <h4 className="font-medium">{rule.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Applied {rule.appliedCount} times • Priority {rule.priority}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" title="Edit rule">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Delete rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-6 border-t">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default EmailRulesModal