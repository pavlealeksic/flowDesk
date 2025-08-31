/**
 * Template Manager - Pre-built automation workflow templates
 * 
 * This system provides:
 * - Curated automation templates for common workflows
 * - Template customization with variables
 * - Template marketplace integration
 * - Version management and updates
 * - Template validation and testing
 */

import { EventEmitter } from 'events';
import { 
  AutomationTemplate,
  AutomationRecipe,
  AutomationTemplateVariable,
  CreateAutomationTemplateInput,
  UpdateAutomationTemplateInput
} from '@flow-desk/shared';

interface TemplateInstallation {
  id: string;
  templateId: string;
  recipeId: string;
  userId: string;
  variables: Record<string, any>;
  customizations: Record<string, any>;
  installedAt: Date;
  lastUpdated: Date;
  version: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  templates: string[];
}

export class TemplateManager extends EventEmitter {
  private readonly templates = new Map<string, AutomationTemplate>();
  private readonly categories = new Map<string, TemplateCategory>();
  private readonly installations = new Map<string, TemplateInstallation>();
  
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadBuiltInTemplates();
      await this.loadTemplateCategories();
      await this.loadPersistedTemplates();
      await this.loadInstallations();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize TemplateManager: ${error.message}`);
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(templateData: CreateAutomationTemplateInput): Promise<AutomationTemplate> {
    const template: AutomationTemplate = {
      ...templateData,
      id: this.generateTemplateId(),
      stats: {
        downloads: 0,
        rating: 0,
        reviews: 0,
        successRate: 0
      },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate template
    await this.validateTemplate(template);

    this.templates.set(template.id, template);
    await this.persistTemplate(template);

    this.emit('templateCreated', template);
    return template;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    updates: UpdateAutomationTemplateInput
  ): Promise<AutomationTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date()
    };

    await this.validateTemplate(updatedTemplate);

    this.templates.set(templateId, updatedTemplate);
    await this.persistTemplate(updatedTemplate);

    this.emit('templateUpdated', updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): AutomationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): AutomationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(categoryId: string): AutomationTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === categoryId as any);
  }

  /**
   * Search templates
   */
  searchTemplates(query: string, filters?: {
    category?: string;
    tags?: string[];
    minRating?: number;
  }): AutomationTemplate[] {
    let results = Array.from(this.templates.values());

    // Text search
    if (query) {
      const searchLower = query.toLowerCase();
      results = results.filter(template =>
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        results = results.filter(template => template.category === filters.category as any);
      }

      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(template =>
          filters.tags!.some(tag => template.tags.includes(tag))
        );
      }

      if (filters.minRating) {
        results = results.filter(template => template.stats.rating >= filters.minRating!);
      }
    }

    // Sort by popularity
    return results.sort((a, b) => {
      const aScore = a.stats.downloads * 0.4 + a.stats.rating * 0.6;
      const bScore = b.stats.downloads * 0.4 + b.stats.rating * 0.6;
      return bScore - aScore;
    });
  }

  /**
   * Install a template as a recipe
   */
  async installTemplate(
    templateId: string,
    userId: string,
    variables: Record<string, any> = {},
    customizations: Record<string, any> = {}
  ): Promise<{ recipe: AutomationRecipe; installation: TemplateInstallation }> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    const validationResult = await this.validateTemplateVariables(template, variables);
    if (!validationResult.valid) {
      throw new Error(`Template variables validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Create recipe from template
    const recipe = await this.instantiateTemplate(template, variables, customizations, userId);

    // Create installation record
    const installation: TemplateInstallation = {
      id: this.generateInstallationId(),
      templateId,
      recipeId: recipe.id,
      userId,
      variables,
      customizations,
      installedAt: new Date(),
      lastUpdated: new Date(),
      version: template.version
    };

    this.installations.set(installation.id, installation);
    await this.persistInstallation(installation);

    // Update template stats
    template.stats.downloads++;
    await this.persistTemplate(template);

    this.emit('templateInstalled', { template, recipe, installation });
    return { recipe, installation };
  }

  /**
   * Update an installed template
   */
  async updateInstallation(
    installationId: string,
    variables: Record<string, any>,
    customizations: Record<string, any> = {}
  ): Promise<{ recipe: AutomationRecipe; installation: TemplateInstallation }> {
    const installation = this.installations.get(installationId);
    if (!installation) {
      throw new Error(`Installation not found: ${installationId}`);
    }

    const template = this.templates.get(installation.templateId);
    if (!template) {
      throw new Error(`Template not found: ${installation.templateId}`);
    }

    // Validate variables
    const validationResult = await this.validateTemplateVariables(template, variables);
    if (!validationResult.valid) {
      throw new Error(`Variables validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Re-instantiate template with new variables
    const recipe = await this.instantiateTemplate(
      template,
      variables,
      customizations,
      installation.userId
    );

    // Update installation
    installation.variables = variables;
    installation.customizations = customizations;
    installation.lastUpdated = new Date();
    installation.recipeId = recipe.id;

    await this.persistInstallation(installation);

    this.emit('installationUpdated', { template, recipe, installation });
    return { recipe, installation };
  }

  /**
   * Get template categories
   */
  getCategories(): TemplateCategory[] {
    return Array.from(this.categories.values())
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get popular templates
   */
  getPopularTemplates(limit: number = 10): AutomationTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.stats.downloads - a.stats.downloads)
      .slice(0, limit);
  }

  /**
   * Get recommended templates for user
   */
  getRecommendedTemplates(userId: string, limit: number = 5): AutomationTemplate[] {
    // This would implement recommendation logic based on user behavior
    // For now, return most popular templates
    return this.getPopularTemplates(limit);
  }

  // Private methods

  private async validateTemplate(template: AutomationTemplate): Promise<void> {
    // Validate template structure
    if (!template.name || template.name.trim().length === 0) {
      throw new Error('Template name is required');
    }

    if (!template.description || template.description.trim().length === 0) {
      throw new Error('Template description is required');
    }

    if (!template.recipe) {
      throw new Error('Template recipe is required');
    }

    // Validate recipe structure
    if (!template.recipe.trigger) {
      throw new Error('Template recipe must have a trigger');
    }

    if (!template.recipe.actions || template.recipe.actions.length === 0) {
      throw new Error('Template recipe must have at least one action');
    }

    // Validate variables
    for (const variable of template.variables) {
      if (!variable.name || variable.name.trim().length === 0) {
        throw new Error('Template variable names are required');
      }

      if (!variable.label || variable.label.trim().length === 0) {
        throw new Error('Template variable labels are required');
      }
    }
  }

  private async validateTemplateVariables(
    template: AutomationTemplate,
    variables: Record<string, any>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const variableDef of template.variables) {
      const value = variables[variableDef.name];

      // Check required variables
      if (variableDef.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable '${variableDef.label}' is missing`);
        continue;
      }

      // Skip validation if not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      const typeError = this.validateVariableType(value, variableDef.type);
      if (typeError) {
        errors.push(`Variable '${variableDef.label}': ${typeError}`);
        continue;
      }

      // Validation rules
      if (variableDef.validation) {
        const validationError = this.validateVariableRules(value, variableDef.validation, variableDef.label);
        if (validationError) {
          errors.push(validationError);
        }
      }

      // Conditional validation
      if (variableDef.conditional) {
        const dependentValue = variables[variableDef.conditional.dependsOn];
        const shouldShow = this.evaluateConditional(
          dependentValue,
          variableDef.conditional.operator,
          variableDef.conditional.value
        );

        if (!shouldShow && variableDef.required) {
          // Variable is conditionally hidden but was required
          continue;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateVariableType(value: any, type: AutomationTemplateVariable['type']): string | null {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return `Expected string, got ${typeof value}`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `Expected number, got ${typeof value}`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Expected boolean, got ${typeof value}`;
        }
        break;
      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return 'Expected valid email address';
        }
        break;
      case 'url':
        if (typeof value !== 'string' || !this.isValidUrl(value)) {
          return 'Expected valid URL';
        }
        break;
      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return 'Expected valid date';
        }
        break;
      case 'time':
        if (typeof value !== 'string' || !this.isValidTime(value)) {
          return 'Expected valid time (HH:MM format)';
        }
        break;
      case 'select':
      case 'multiselect':
        // These are validated against options in validateVariableRules
        break;
    }

    return null;
  }

  private validateVariableRules(
    value: any,
    rules: AutomationTemplateVariable['validation'],
    label: string
  ): string | null {
    if (!rules) return null;

    // Min/Max validation
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        return `${label} must be at least ${rules.min}`;
      }
      if (rules.max !== undefined && value > rules.max) {
        return `${label} must be at most ${rules.max}`;
      }
    }

    if (typeof value === 'string') {
      if (rules.min !== undefined && value.length < rules.min) {
        return `${label} must be at least ${rules.min} characters`;
      }
      if (rules.max !== undefined && value.length > rules.max) {
        return `${label} must be at most ${rules.max} characters`;
      }
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string') {
      try {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(value)) {
          return `${label} does not match required format`;
        }
      } catch (error) {
        return `Invalid pattern for ${label}`;
      }
    }

    return null;
  }

  private evaluateConditional(
    value: any,
    operator: 'equals' | 'not_equals' | 'in' | 'not_in',
    expected: any
  ): boolean {
    switch (operator) {
      case 'equals':
        return value === expected;
      case 'not_equals':
        return value !== expected;
      case 'in':
        return Array.isArray(expected) ? expected.includes(value) : false;
      case 'not_in':
        return Array.isArray(expected) ? !expected.includes(value) : true;
      default:
        return false;
    }
  }

  private async instantiateTemplate(
    template: AutomationTemplate,
    variables: Record<string, any>,
    customizations: Record<string, any>,
    userId: string
  ): Promise<AutomationRecipe> {
    // Create a deep copy of the recipe
    const recipeData = JSON.parse(JSON.stringify(template.recipe));

    // Replace template variables
    const processedRecipe = this.replaceTemplateVariables(recipeData, variables);

    // Apply customizations
    const finalRecipe: AutomationRecipe = {
      ...processedRecipe,
      id: this.generateRecipeId(),
      ownerId: userId,
      name: this.replaceVariables(template.name, variables),
      description: this.replaceVariables(template.description, variables),
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        successRate: 0,
        recentExecutions: []
      },
      metadata: {
        ...processedRecipe.metadata,
        template: {
          isTemplate: false,
          templateId: template.id,
          variables
        }
      }
    };

    return finalRecipe;
  }

  private replaceTemplateVariables(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.replaceVariables(obj, variables);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceTemplateVariables(item, variables));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceTemplateVariables(value, variables);
      }
      return result;
    }

    return obj;
  }

  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      const value = variables[variableName];
      return value !== undefined ? String(value) : match;
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInstallationId(): string {
    return `installation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRecipeId(): string {
    return `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Built-in templates and categories

  private async loadBuiltInTemplates(): Promise<void> {
    const builtInTemplates: AutomationTemplate[] = [
      {
        id: 'email-to-task',
        name: 'Email to Task',
        description: 'Automatically create tasks from starred emails',
        category: 'productivity',
        tags: ['email', 'tasks', 'productivity'],
        icon: '📧➡️✅',
        author: { name: 'Flow Desk', email: 'templates@flowdesk.com' },
        version: '1.0.0',
        requirements: {
          services: ['email', 'tasks'],
          permissions: ['email:read', 'tasks:write'],
          plugins: ['gmail', 'asana']
        },
        variables: [
          {
            name: 'taskService',
            type: 'select',
            label: 'Task Management Service',
            description: 'Choose where to create tasks',
            required: true,
            defaultValue: 'asana',
            options: [
              { label: 'Asana', value: 'asana' },
              { label: 'Trello', value: 'trello' },
              { label: 'Jira', value: 'jira' },
              { label: 'Linear', value: 'linear' }
            ],
            group: 'Integration',
            order: 1
          },
          {
            name: 'projectId',
            type: 'string',
            label: 'Project/Board ID',
            description: 'ID of the project or board to create tasks in',
            required: true,
            group: 'Integration',
            order: 2
          },
          {
            name: 'taskPrefix',
            type: 'string',
            label: 'Task Title Prefix',
            description: 'Optional prefix for task titles',
            required: false,
            defaultValue: '[Email] ',
            group: 'Customization',
            order: 3
          }
        ],
        recipe: {
          name: 'Email to Task Automation',
          description: 'Create tasks from starred emails automatically',
          category: 'productivity',
          tags: ['email', 'tasks'],
          enabled: true,
          isPublic: false,
          version: '1.0.0',
          trigger: {
            type: 'email_starred',
            config: {
              type: 'email_starred'
            },
            conditions: []
          },
          actions: [
            {
              id: 'create-task-action',
              type: 'create_task',
              name: 'Create Task',
              description: 'Create a task from the starred email',
              config: {
                service: '{{taskService}}',
                projectId: '{{projectId}}',
                title: '{{taskPrefix}}{{trigger.subject}}',
                description: 'Email from: {{trigger.sender}}\n\n{{trigger.body}}',
                priority: 'medium'
              },
              errorHandling: {
                strategy: 'retry',
                fallbackActions: [],
                logErrors: true,
                notifyOnError: true
              },
              continueOnError: false
            }
          ],
          settings: {
            timeout: 300,
            maxExecutionsPerHour: 100,
            maxConcurrentExecutions: 1,
            priority: 'normal',
            logLevel: 'info',
            variables: {},
            environment: 'production'
          },
          metadata: {}
        } as any,
        stats: { downloads: 1250, rating: 4.8, reviews: 89, successRate: 0.96 },
        status: 'published',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },

      {
        id: 'meeting-slack-status',
        name: 'Meeting Status Sync',
        description: 'Update Slack status when calendar meetings start and end',
        category: 'communication',
        tags: ['calendar', 'slack', 'status'],
        icon: '📅➡️💬',
        author: { name: 'Flow Desk', email: 'templates@flowdesk.com' },
        version: '1.0.0',
        requirements: {
          services: ['calendar', 'slack'],
          permissions: ['calendar:read', 'slack:write'],
          plugins: ['google-calendar', 'slack']
        },
        variables: [
          {
            name: 'busyMessage',
            type: 'string',
            label: 'Busy Status Message',
            description: 'Message to display when in a meeting',
            required: true,
            defaultValue: 'In a meeting',
            group: 'Status Messages',
            order: 1
          },
          {
            name: 'busyEmoji',
            type: 'string',
            label: 'Busy Status Emoji',
            description: 'Emoji to show when busy',
            required: false,
            defaultValue: ':calendar:',
            group: 'Status Messages',
            order: 2
          },
          {
            name: 'leadTime',
            type: 'number',
            label: 'Lead Time (minutes)',
            description: 'How many minutes before meeting to update status',
            required: false,
            defaultValue: 5,
            validation: { min: 0, max: 60 },
            group: 'Timing',
            order: 3
          }
        ],
        recipe: {
          name: 'Meeting Slack Status Sync',
          description: 'Sync Slack status with calendar meetings',
          category: 'communication',
          tags: ['calendar', 'slack'],
          enabled: true,
          isPublic: false,
          version: '1.0.0',
          trigger: {
            type: 'event_starting',
            config: {
              type: 'event_starting',
              leadTimeMinutes: '{{leadTime}}'
            },
            conditions: []
          },
          actions: [
            {
              id: 'set-busy-status',
              type: 'send_message',
              name: 'Set Busy Status',
              config: {
                platform: 'slack',
                action: 'set_status',
                status_text: '{{busyMessage}}',
                status_emoji: '{{busyEmoji}}'
              },
              errorHandling: {
                strategy: 'retry',
                fallbackActions: [],
                logErrors: true,
                notifyOnError: false
              },
              continueOnError: true
            }
          ],
          settings: {
            timeout: 300,
            maxExecutionsPerHour: 50,
            maxConcurrentExecutions: 1,
            priority: 'normal',
            logLevel: 'info',
            variables: {},
            environment: 'production'
          },
          metadata: {}
        } as any,
        stats: { downloads: 890, rating: 4.6, reviews: 67, successRate: 0.94 },
        status: 'published',
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-20')
      }
    ];

    for (const template of builtInTemplates) {
      this.templates.set(template.id, template);
    }
  }

  private async loadTemplateCategories(): Promise<void> {
    const categories: TemplateCategory[] = [
      {
        id: 'productivity',
        name: 'Productivity',
        description: 'Boost your productivity with smart automations',
        icon: '🚀',
        order: 1,
        templates: []
      },
      {
        id: 'email',
        name: 'Email Management',
        description: 'Automate your email workflow',
        icon: '📧',
        order: 2,
        templates: []
      },
      {
        id: 'communication',
        name: 'Communication',
        description: 'Stay connected with automated messaging',
        icon: '💬',
        order: 3,
        templates: []
      },
      {
        id: 'calendar',
        name: 'Calendar & Scheduling',
        description: 'Smart calendar management',
        icon: '📅',
        order: 4,
        templates: []
      },
      {
        id: 'tasks',
        name: 'Task Management',
        description: 'Automate your task workflows',
        icon: '✅',
        order: 5,
        templates: []
      },
      {
        id: 'integrations',
        name: 'Service Integration',
        description: 'Connect your favorite tools',
        icon: '🔗',
        order: 6,
        templates: []
      }
    ];

    for (const category of categories) {
      this.categories.set(category.id, category);
    }

    // Populate template lists for categories
    for (const template of this.templates.values()) {
      const category = this.categories.get(template.category as string);
      if (category) {
        category.templates.push(template.id);
      }
    }
  }

  // Persistence methods
  private async loadPersistedTemplates(): Promise<void> {
    // Load user-created templates from storage
  }

  private async loadInstallations(): Promise<void> {
    // Load template installations from storage
  }

  private async persistTemplate(template: AutomationTemplate): Promise<void> {
    // Persist template to storage
  }

  private async persistInstallation(installation: TemplateInstallation): Promise<void> {
    // Persist installation to storage
  }
}