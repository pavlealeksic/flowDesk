/**
 * Template System Types - Flow Desk
 * 
 * Comprehensive TypeScript interfaces for all template types
 * including email templates, calendar event templates, and text snippets.
 */

// Base Template Interface
export interface BaseTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  variables: TemplateVariable[];
  isDefault?: boolean;
  isGlobal?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  lastUsed?: Date;
  usageCount: number;
}

// Template Variable Definition
export interface TemplateVariable {
  key: string;
  label: string;
  description?: string;
  type: TemplateVariableType;
  defaultValue?: string;
  isRequired: boolean;
  placeholder?: string;
  validation?: TemplateVariableValidation;
  options?: string[]; // For select/multiselect types
  group?: string; // For organizing variables in UI
  order?: number; // Display order
  dependsOn?: string; // Conditional display
  showIf?: string; // Condition expression
}

export type TemplateVariableType = 
  | 'text'
  | 'email'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'boolean'
  | 'currency'
  | 'percentage'
  | 'phone'
  | 'address'
  | 'url'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'richtext'
  | 'color'
  | 'file';

export interface TemplateVariableValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string; // Regex pattern
  customValidator?: string; // Custom validation function name
  errorMessage?: string;
}

// Email Template
export interface EmailTemplate extends BaseTemplate {
  type: 'email';
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachments?: EmailTemplateAttachment[];
  sender?: string;
  replyTo?: string;
  priority?: 'low' | 'normal' | 'high';
  tracking?: EmailTrackingOptions;
  schedule?: EmailScheduleOptions;
}

export interface EmailTemplateAttachment {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  isTemplate?: boolean; // If true, path is a template
  condition?: string; // Conditional attachment
}

export interface EmailTrackingOptions {
  openTracking: boolean;
  clickTracking: boolean;
  deliveryNotification: boolean;
  readReceipt: boolean;
}

export interface EmailScheduleOptions {
  timezone: string;
  sendTime?: string; // HH:MM format
  delay?: number; // Minutes to delay
  recurring?: RecurringOptions;
}

// Calendar Event Template
export interface CalendarEventTemplate extends BaseTemplate {
  type: 'calendar';
  title: string;
  description?: string;
  location?: string;
  duration: number; // Minutes
  allDay: boolean;
  reminder?: ReminderOptions[];
  attendees?: string[]; // Template for attendee emails
  recurrence?: RecurringOptions;
  visibility: 'private' | 'public' | 'confidential';
  color?: string;
  meetingRoom?: string;
  agenda?: string;
  preparationNotes?: string;
  followUpTasks?: string[];
}

export interface ReminderOptions {
  method: 'email' | 'popup' | 'sms' | 'notification';
  minutesBefore: number;
  message?: string;
}

export interface RecurringOptions {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N frequency units
  endDate?: Date;
  occurrences?: number;
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  weekOfMonth?: number; // 1-4, -1 for last
}

// Text Snippet Template
export interface TextSnippetTemplate extends BaseTemplate {
  type: 'snippet';
  content: string;
  shortcut?: string;
  autoExpand: boolean;
  context: SnippetContext[];
  formatting: TextFormatting;
  insertionPoint?: 'cursor' | 'start' | 'end' | 'replace';
}

export type SnippetContext = 
  | 'email'
  | 'calendar'
  | 'chat'
  | 'document'
  | 'form'
  | 'global';

export interface TextFormatting {
  preserveFormatting: boolean;
  stripHtml: boolean;
  convertMarkdown: boolean;
  autoCapitalize: boolean;
  autoCorrect: boolean;
}

// Template Category
export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string; // For nested categories
  order: number;
  isSystem: boolean; // Cannot be deleted
  templateCount: number;
}

// Template Collection (for organizing templates)
export interface TemplateCollection {
  id: string;
  name: string;
  description?: string;
  templateIds: string[];
  isShared: boolean;
  permissions: CollectionPermissions;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CollectionPermissions {
  canView: string[];
  canEdit: string[];
  canDelete: string[];
  isPublic: boolean;
}

// Template Usage Analytics
export interface TemplateUsage {
  templateId: string;
  usedAt: Date;
  userId: string;
  context: string;
  variablesUsed: Record<string, string>;
  renderTime: number; // Milliseconds
  errors?: string[];
}

export interface TemplateAnalytics {
  templateId: string;
  totalUsage: number;
  uniqueUsers: number;
  averageRenderTime: number;
  errorRate: number;
  popularVariables: Record<string, number>;
  usageTrend: AnalyticsDataPoint[];
  lastUsed: Date;
}

export interface AnalyticsDataPoint {
  date: Date;
  count: number;
  averageRenderTime?: number;
  errorCount?: number;
}

// Template Storage and Sync
export interface TemplateStorageConfig {
  storageType: 'file' | 'database' | 'cloud';
  basePath: string;
  syncEnabled: boolean;
  cloudProvider?: 'aws' | 'azure' | 'gcp' | 'custom';
  encryptionEnabled: boolean;
  backupEnabled: boolean;
  compressionEnabled: boolean;
}

export interface TemplateSync {
  lastSync: Date;
  syncStatus: 'idle' | 'syncing' | 'error' | 'conflict';
  conflictedTemplates: string[];
  syncErrors: TemplateSyncError[];
}

export interface TemplateSyncError {
  templateId: string;
  error: string;
  timestamp: Date;
  resolved: boolean;
}

// Template Import/Export
export interface TemplateExport {
  version: string;
  exportedAt: Date;
  templates: (EmailTemplate | CalendarEventTemplate | TextSnippetTemplate)[];
  categories: TemplateCategory[];
  collections: TemplateCollection[];
  metadata: TemplateExportMetadata;
}

export interface TemplateExportMetadata {
  source: string;
  version: string;
  totalTemplates: number;
  includedTypes: ('email' | 'calendar' | 'snippet')[];
  exportedBy: string;
  checksum: string;
}

export interface TemplateImportOptions {
  overwriteExisting: boolean;
  preserveIds: boolean;
  skipInvalid: boolean;
  categoryMapping: Record<string, string>;
  variableMapping: Record<string, Record<string, string>>;
}

export interface TemplateImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: TemplateImportError[];
  warnings: string[];
  mappedIds: Record<string, string>; // old ID -> new ID
}

export interface TemplateImportError {
  templateName: string;
  error: string;
  line?: number;
  severity: 'error' | 'warning';
}

// Template Rendering Context
export interface TemplateRenderContext {
  variables: Record<string, any>;
  userInfo: {
    name: string;
    email: string;
    timezone: string;
    locale: string;
  };
  currentTime: Date;
  metadata: Record<string, any>;
  formatting: RenderFormatting;
}

export interface RenderFormatting {
  dateFormat: string;
  timeFormat: string;
  currencyFormat: string;
  numberFormat: string;
  locale: string;
  timezone: string;
}

export interface TemplateRenderResult {
  success: boolean;
  rendered: {
    subject?: string;
    body?: string;
    bodyHtml?: string;
    bodyText?: string;
    content?: string;
    title?: string;
    [key: string]: any;
  };
  variables: Record<string, any>;
  renderTime: number;
  warnings: string[];
  errors: string[];
  metadata: Record<string, any>;
}

// Template Search and Filtering
export interface TemplateSearchOptions {
  query?: string;
  type?: ('email' | 'calendar' | 'snippet')[];
  category?: string[];
  tags?: string[];
  createdBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: 'name' | 'created' | 'updated' | 'usage' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeSystem?: boolean;
  includeGlobal?: boolean;
}

export interface TemplateSearchResult {
  templates: (EmailTemplate | CalendarEventTemplate | TextSnippetTemplate)[];
  total: number;
  facets: {
    types: Record<string, number>;
    categories: Record<string, number>;
    tags: Record<string, number>;
    creators: Record<string, number>;
  };
  searchTime: number;
  suggestions: string[];
}

// Template Validation
export interface TemplateValidationResult {
  valid: boolean;
  errors: TemplateValidationError[];
  warnings: string[];
  suggestions: string[];
}

export interface TemplateValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
  line?: number;
  column?: number;
}

// Template Service Configuration
export interface TemplateServiceConfig {
  storage: TemplateStorageConfig;
  rendering: {
    engine: 'handlebars' | 'mustache' | 'custom';
    enableSandbox: boolean;
    timeout: number;
    cacheEnabled: boolean;
    cacheSize: number;
    cacheTTL: number;
  };
  validation: {
    strictMode: boolean;
    validateOnSave: boolean;
    validateOnRender: boolean;
    allowCustomVariables: boolean;
  };
  analytics: {
    enabled: boolean;
    trackUsage: boolean;
    trackPerformance: boolean;
    retentionDays: number;
  };
  sync: {
    enabled: boolean;
    interval: number;
    conflictResolution: 'merge' | 'overwrite' | 'manual';
  };
}

// Utility Types
export type TemplateType = 'email' | 'calendar' | 'snippet';
export type AnyTemplate = EmailTemplate | CalendarEventTemplate | TextSnippetTemplate;

export interface TemplateOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

// Event Types for Template System
export interface TemplateEventMap {
  'template:created': { template: AnyTemplate };
  'template:updated': { template: AnyTemplate; changes: string[] };
  'template:deleted': { templateId: string; type: TemplateType };
  'template:used': { template: AnyTemplate; context: string };
  'template:rendered': { template: AnyTemplate; result: TemplateRenderResult };
  'template:error': { templateId: string; error: string };
  'category:created': { category: TemplateCategory };
  'category:updated': { category: TemplateCategory };
  'category:deleted': { categoryId: string };
  'collection:created': { collection: TemplateCollection };
  'collection:updated': { collection: TemplateCollection };
  'collection:deleted': { collectionId: string };
  'sync:started': {};
  'sync:completed': { result: TemplateSync };
  'sync:error': { error: string };
}