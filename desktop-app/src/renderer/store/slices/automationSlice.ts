import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AutomationTrigger {
  type: string
  config: Record<string, any>
}

interface AutomationCondition {
  type: string
  config: Record<string, any>
  negate: boolean
}

interface AutomationAction {
  type: string
  config: Record<string, any>
  continueOnError: boolean
}

interface AutomationRule {
  id: string
  name: string
  description?: string
  enabled: boolean
  trigger: AutomationTrigger
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  settings: {
    runOnce: boolean
    maxExecutions?: number
    timeout: number
    retries: number
  }
  stats: {
    executions: number
    successes: number
    failures: number
    lastExecution?: number
  }
  createdAt: number
  updatedAt: number
}

interface AutomationExecution {
  id: string
  ruleId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: number
  completedAt?: number
  context: Record<string, any>
  result?: any
  error?: string
  logs: Array<{
    timestamp: number
    level: 'info' | 'warn' | 'error'
    message: string
  }>
}

interface AutomationTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  icon?: string
  template: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'stats'>
  author?: string
  version: string
}

interface AutomationState {
  rules: AutomationRule[]
  executions: AutomationExecution[]
  templates: AutomationTemplate[]
  isLoading: boolean
  error: string | null
  settings: {
    enabled: boolean
    maxConcurrentExecutions: number
    executionTimeout: number
    logRetentionDays: number
    notifyOnFailure: boolean
  }
  activeExecutions: string[]
  executionHistory: {
    page: number
    limit: number
    hasMore: boolean
    total: number
  }
}

const initialState: AutomationState = {
  rules: [],
  executions: [],
  templates: [],
  isLoading: false,
  error: null,
  settings: {
    enabled: true,
    maxConcurrentExecutions: 10,
    executionTimeout: 300000, // 5 minutes
    logRetentionDays: 30,
    notifyOnFailure: true
  },
  activeExecutions: [],
  executionHistory: {
    page: 1,
    limit: 50,
    hasMore: false,
    total: 0
  }
}

const automationSlice = createSlice({
  name: 'automation',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    addRule: (state, action: PayloadAction<Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'stats'>>) => {
      const rule: AutomationRule = {
        ...action.payload,
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        stats: {
          executions: 0,
          successes: 0,
          failures: 0
        }
      }
      state.rules.push(rule)
    },
    
    updateRule: (state, action: PayloadAction<{ id: string; updates: Partial<AutomationRule> }>) => {
      const { id, updates } = action.payload
      const rule = state.rules.find(r => r.id === id)
      if (rule) {
        Object.assign(rule, updates, { updatedAt: Date.now() })
      }
    },
    
    removeRule: (state, action: PayloadAction<string>) => {
      const index = state.rules.findIndex(r => r.id === action.payload)
      if (index > -1) {
        state.rules.splice(index, 1)
      }
    },
    
    toggleRule: (state, action: PayloadAction<string>) => {
      const rule = state.rules.find(r => r.id === action.payload)
      if (rule) {
        rule.enabled = !rule.enabled
        rule.updatedAt = Date.now()
      }
    },
    
    addExecution: (state, action: PayloadAction<Omit<AutomationExecution, 'id' | 'startedAt' | 'logs'>>) => {
      const execution: AutomationExecution = {
        ...action.payload,
        id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startedAt: Date.now(),
        logs: []
      }
      state.executions.unshift(execution)
      
      if (execution.status === 'running') {
        state.activeExecutions.push(execution.id)
      }
      
      // Keep only last 1000 executions
      if (state.executions.length > 1000) {
        state.executions = state.executions.slice(0, 1000)
      }
    },
    
    updateExecution: (state, action: PayloadAction<{ id: string; updates: Partial<AutomationExecution> }>) => {
      const { id, updates } = action.payload
      const execution = state.executions.find(e => e.id === id)
      if (execution) {
        Object.assign(execution, updates)
        
        // Update active executions
        const isActive = ['pending', 'running'].includes(execution.status)
        const wasActive = state.activeExecutions.includes(id)
        
        if (isActive && !wasActive) {
          state.activeExecutions.push(id)
        } else if (!isActive && wasActive) {
          const index = state.activeExecutions.indexOf(id)
          state.activeExecutions.splice(index, 1)
        }
        
        // Update rule stats
        if (['completed', 'failed'].includes(execution.status)) {
          const rule = state.rules.find(r => r.id === execution.ruleId)
          if (rule) {
            rule.stats.executions += 1
            rule.stats.lastExecution = execution.completedAt || Date.now()
            if (execution.status === 'completed') {
              rule.stats.successes += 1
            } else {
              rule.stats.failures += 1
            }
          }
        }
      }
    },
    
    addExecutionLog: (state, action: PayloadAction<{ 
      executionId: string; 
      log: { level: 'info' | 'warn' | 'error'; message: string } 
    }>) => {
      const { executionId, log } = action.payload
      const execution = state.executions.find(e => e.id === executionId)
      if (execution) {
        execution.logs.push({
          ...log,
          timestamp: Date.now()
        })
        
        // Keep only last 100 logs per execution
        if (execution.logs.length > 100) {
          execution.logs = execution.logs.slice(-100)
        }
      }
    },
    
    cancelExecution: (state, action: PayloadAction<string>) => {
      const execution = state.executions.find(e => e.id === action.payload)
      if (execution && ['pending', 'running'].includes(execution.status)) {
        execution.status = 'cancelled'
        execution.completedAt = Date.now()
        
        const index = state.activeExecutions.indexOf(action.payload)
        if (index > -1) {
          state.activeExecutions.splice(index, 1)
        }
      }
    },
    
    clearExecutions: (state) => {
      state.executions = []
      state.activeExecutions = []
    },
    
    setTemplates: (state, action: PayloadAction<AutomationTemplate[]>) => {
      state.templates = action.payload
    },
    
    addTemplate: (state, action: PayloadAction<AutomationTemplate>) => {
      state.templates.push(action.payload)
    },
    
    updateSettings: (state, action: PayloadAction<Partial<AutomationState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload }
    },
    
    clearError: (state) => {
      state.error = null
    }
  }
})

export const {
  setLoading,
  setError,
  addRule,
  updateRule,
  removeRule,
  toggleRule,
  addExecution,
  updateExecution,
  addExecutionLog,
  cancelExecution,
  clearExecutions,
  setTemplates,
  addTemplate,
  updateSettings,
  clearError
} = automationSlice.actions

export default automationSlice.reducer