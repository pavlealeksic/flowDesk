import log from 'electron-log';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class EmailTemplateManager {
  private templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.loadDefaultTemplates();
  }

  private loadDefaultTemplates(): void {
    const defaults: EmailTemplate[] = [
      {
        id: 'follow-up',
        name: 'Follow Up',
        subject: 'Following up on our conversation',
        body: 'Hi {{name}},\n\nI wanted to follow up on our recent conversation about {{topic}}.\n\nBest regards,\n{{signature}}',
        tags: ['follow-up', 'business'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'meeting-request',
        name: 'Meeting Request',
        subject: 'Meeting Request: {{topic}}',
        body: 'Hi {{name}},\n\nI would like to schedule a meeting to discuss {{topic}}.\n\nPlease let me know your availability.\n\nBest regards,\n{{signature}}',
        tags: ['meeting', 'business'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const template of defaults) {
      this.templates.set(template.id, template);
    }
  }

  getTemplate(id: string): EmailTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  async createTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    const newTemplate: EmailTemplate = {
      ...template,
      id: `tmpl_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(newTemplate.id, newTemplate);
    log.info(`Created email template: ${newTemplate.name}`);
    return newTemplate;
  }

  renderTemplate(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string } {
    let renderedSubject = template.subject;
    let renderedBody = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), value);
      renderedBody = renderedBody.replace(new RegExp(placeholder, 'g'), value);
    }

    return {
      subject: renderedSubject,
      body: renderedBody,
    };
  }

  // Additional methods expected by main.ts
  getTemplatesByCategory(category: string): EmailTemplate[] {
    return this.getAllTemplates().filter(template => 
      template.tags.includes(category)
    );
  }

  async saveTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    return this.createTemplate(template);
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  useTemplate(id: string): EmailTemplate | undefined {
    return this.getTemplate(id);
  }

  searchTemplates(query: string): EmailTemplate[] {
    const queryLower = query.toLowerCase();
    return this.getAllTemplates().filter(template =>
      template.name.toLowerCase().includes(queryLower) ||
      template.subject.toLowerCase().includes(queryLower) ||
      template.body.toLowerCase().includes(queryLower) ||
      template.tags.some(tag => tag.toLowerCase().includes(queryLower))
    );
  }

  processTemplateVariables(templateId: string, variables: Record<string, string>): { subject: string; body: string } | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;
    
    return this.renderTemplate(template, variables);
  }
}