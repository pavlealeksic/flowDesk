import log from 'electron-log';

export interface EmailRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: EmailCondition[];
  actions: EmailAction[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'has_attachment';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
  value: string;
  caseSensitive?: boolean;
}

export interface EmailAction {
  type: 'move_to_folder' | 'add_label' | 'mark_as_read' | 'mark_as_important' | 'forward' | 'delete';
  value?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  hasAttachment: boolean;
}

export class EmailRulesEngine {
  private rules: Map<string, EmailRule> = new Map();

  constructor() {
    this.loadDefaultRules();
  }

  private loadDefaultRules(): void {
    const defaultRules: EmailRule[] = [
      {
        id: 'spam-filter',
        name: 'Spam Filter',
        enabled: true,
        conditions: [
          { field: 'subject', operator: 'contains', value: '[SPAM]', caseSensitive: false }
        ],
        actions: [
          { type: 'move_to_folder', value: 'Spam' }
        ],
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'newsletter-filter',
        name: 'Newsletter Organization',
        enabled: true,
        conditions: [
          { field: 'from', operator: 'contains', value: 'noreply', caseSensitive: false }
        ],
        actions: [
          { type: 'add_label', value: 'Newsletter' },
          { type: 'mark_as_read' }
        ],
        priority: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  async processEmail(email: EmailMessage): Promise<EmailAction[]> {
    const applicableActions: EmailAction[] = [];
    
    // Sort rules by priority
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.evaluateRule(rule, email)) {
        applicableActions.push(...rule.actions);
        log.debug(`Applied rule "${rule.name}" to email: ${email.subject}`);
      }
    }

    return applicableActions;
  }

  private evaluateRule(rule: EmailRule, email: EmailMessage): boolean {
    return rule.conditions.every(condition => this.evaluateCondition(condition, email));
  }

  private evaluateCondition(condition: EmailCondition, email: EmailMessage): boolean {
    let fieldValue: string;
    
    switch (condition.field) {
      case 'from':
        fieldValue = email.from;
        break;
      case 'to':
        fieldValue = email.to.join(', ');
        break;
      case 'subject':
        fieldValue = email.subject;
        break;
      case 'body':
        fieldValue = email.body;
        break;
      case 'has_attachment':
        return email.hasAttachment === (condition.value.toLowerCase() === 'true');
      default:
        return false;
    }

    if (!condition.caseSensitive) {
      fieldValue = fieldValue.toLowerCase();
      condition.value = condition.value.toLowerCase();
    }

    switch (condition.operator) {
      case 'contains':
        return fieldValue.includes(condition.value);
      case 'equals':
        return fieldValue === condition.value;
      case 'starts_with':
        return fieldValue.startsWith(condition.value);
      case 'ends_with':
        return fieldValue.endsWith(condition.value);
      case 'regex':
        try {
          const regex = new RegExp(condition.value, condition.caseSensitive ? '' : 'i');
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  async createRule(rule: Omit<EmailRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailRule> {
    const newRule: EmailRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(newRule.id, newRule);
    log.info(`Created email rule: ${newRule.name}`);
    return newRule;
  }

  async updateRule(id: string, updates: Partial<EmailRule>): Promise<EmailRule | undefined> {
    const rule = this.rules.get(id);
    if (!rule) return undefined;

    const updatedRule = {
      ...rule,
      ...updates,
      id: rule.id,
      createdAt: rule.createdAt,
      updatedAt: new Date(),
    };

    this.rules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.rules.delete(id);
  }

  getAllRules(): EmailRule[] {
    return Array.from(this.rules.values());
  }

  getRule(id: string): EmailRule | undefined {
    return this.rules.get(id);
  }

  // Methods expected by main.ts
  async initialize(): Promise<void> {
    log.info('Email rules engine initializing...');
    // Load rules from storage if needed
  }

  getRuleStats(): any {
    return {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalConditions: Array.from(this.rules.values()).reduce((sum, rule) => sum + rule.conditions.length, 0),
      totalActions: Array.from(this.rules.values()).reduce((sum, rule) => sum + rule.actions.length, 0),
    };
  }
}