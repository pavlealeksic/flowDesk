/**
 * Variable Resolver - Advanced variable and template processing system
 * 
 * This system provides:
 * - Dynamic variable resolution with scoping
 * - Template string processing with complex expressions
 * - Data transformation and manipulation
 * - Type-safe variable validation
 * - Performance optimized with caching
 */

import { 
  AutomationVariable,
  AutomationVariableContext 
} from '@flow-desk/shared';

interface ResolverContext {
  variables: AutomationVariableContext;
  functions: Record<string, Function>;
  triggerData: any;
  metadata: {
    timestamp: Date;
    executionId: string;
    userId: string;
    recipeId: string;
  };
}

interface VariableReference {
  scope: string;
  path: string;
  fullPath: string;
  transforms: string[];
}

interface ResolverOptions {
  throwOnMissing: boolean;
  defaultValues: Record<string, any>;
  transformers: Record<string, Function>;
  validators: Record<string, Function>;
}

export class VariableResolver {
  private readonly templateCache = new Map<string, Function>();
  private readonly variableCache = new Map<string, any>();
  private readonly transformerRegistry = new Map<string, Function>();
  private readonly validatorRegistry = new Map<string, Function>();
  
  private cacheEnabled = true;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.registerBuiltInTransformers();
    this.registerBuiltInValidators();
  }

  /**
   * Resolve all variables in a configuration object
   */
  async resolveVariables(
    config: any,
    context: AutomationVariableContext,
    options: Partial<ResolverOptions> = {}
  ): Promise<any> {
    const resolverContext: ResolverContext = {
      variables: context,
      functions: this.getBuiltInFunctions(),
      triggerData: context.execution.trigger || {},
      metadata: {
        timestamp: new Date(),
        executionId: context.execution.executionId || 'unknown',
        userId: context.execution.userId || 'unknown',
        recipeId: context.execution.recipeId || 'unknown'
      }
    };

    const resolverOptions: ResolverOptions = {
      throwOnMissing: false,
      defaultValues: {},
      transformers: Object.fromEntries(this.transformerRegistry),
      validators: Object.fromEntries(this.validatorRegistry),
      ...options
    };

    return this.resolveValue(config, resolverContext, resolverOptions);
  }

  /**
   * Resolve a single template string
   */
  async resolveTemplate(
    template: string,
    context: AutomationVariableContext,
    options: Partial<ResolverOptions> = {}
  ): Promise<string> {
    const resolverContext: ResolverContext = {
      variables: context,
      functions: this.getBuiltInFunctions(),
      triggerData: context.execution.trigger || {},
      metadata: {
        timestamp: new Date(),
        executionId: context.execution.executionId || 'unknown',
        userId: context.execution.userId || 'unknown',
        recipeId: context.execution.recipeId || 'unknown'
      }
    };

    const resolverOptions: ResolverOptions = {
      throwOnMissing: false,
      defaultValues: {},
      transformers: Object.fromEntries(this.transformerRegistry),
      validators: Object.fromEntries(this.validatorRegistry),
      ...options
    };

    return this.processTemplate(template, resolverContext, resolverOptions);
  }

  /**
   * Validate variable values against their definitions
   */
  async validateVariables(
    variables: Record<string, any>,
    definitions: Record<string, AutomationVariable>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const [name, definition] of Object.entries(definitions)) {
      const value = variables[name];

      // Check if required variable is present
      if (definition.required && (value === undefined || value === null)) {
        errors.push(`Required variable '${name}' is missing`);
        continue;
      }

      // Skip validation if value is not present and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      const typeError = this.validateVariableType(value, definition.type);
      if (typeError) {
        errors.push(`Variable '${name}': ${typeError}`);
        continue;
      }

      // Custom validation
      if (definition.validation) {
        const validationError = await this.validateVariableRules(value, definition.validation, name);
        if (validationError) {
          errors.push(validationError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Register a custom transformer function
   */
  registerTransformer(name: string, transformer: Function): void {
    this.transformerRegistry.set(name, transformer);
  }

  /**
   * Register a custom validator function
   */
  registerValidator(name: string, validator: Function): void {
    this.validatorRegistry.set(name, validator);
  }

  /**
   * Clear resolver caches
   */
  clearCache(): void {
    this.templateCache.clear();
    this.variableCache.clear();
  }

  // Private methods

  private async resolveValue(
    value: any,
    context: ResolverContext,
    options: ResolverOptions
  ): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return Promise.all(value.map(item => this.resolveValue(item, context, options)));
    }

    // Handle objects
    if (typeof value === 'object') {
      const resolved: any = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = await this.resolveValue(val, context, options);
      }
      return resolved;
    }

    // Handle strings (potential templates or variable references)
    if (typeof value === 'string') {
      // Check if it's a variable reference
      if (value.startsWith('$')) {
        return this.resolveVariableReference(value, context, options);
      }

      // Check if it contains template expressions
      if (value.includes('{{') && value.includes('}}')) {
        return this.processTemplate(value, context, options);
      }
    }

    return value;
  }

  private resolveVariableReference(
    reference: string,
    context: ResolverContext,
    options: ResolverOptions
  ): any {
    const cacheKey = `var:${reference}:${context.metadata.executionId}`;
    
    if (this.cacheEnabled && this.variableCache.has(cacheKey)) {
      const cached = this.variableCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.value;
      }
    }

    try {
      const parsed = this.parseVariableReference(reference);
      const value = this.getVariableValue(parsed, context);
      const transformed = this.applyTransforms(value, parsed.transforms, context);

      if (this.cacheEnabled) {
        this.variableCache.set(cacheKey, {
          value: transformed,
          timestamp: Date.now()
        });
      }

      return transformed;
    } catch (error) {
      if (options.throwOnMissing) {
        throw error;
      }

      // Return default value or the reference itself
      const defaultKey = reference.substring(1); // Remove $
      return options.defaultValues[defaultKey] || reference;
    }
  }

  private parseVariableReference(reference: string): VariableReference {
    // Remove $ prefix
    const path = reference.substring(1);
    
    // Split by | for transforms
    const [mainPath, ...transforms] = path.split('|').map(s => s.trim());
    
    // Split scope and path
    const [scope, ...pathParts] = mainPath.split('.');
    const variablePath = pathParts.join('.');

    return {
      scope,
      path: variablePath,
      fullPath: mainPath,
      transforms
    };
  }

  private getVariableValue(parsed: VariableReference, context: ResolverContext): any {
    let scopeData: any;

    switch (parsed.scope) {
      case 'global':
        scopeData = context.variables.global;
        break;
      case 'recipe':
        scopeData = context.variables.recipe;
        break;
      case 'execution':
        scopeData = context.variables.execution;
        break;
      case 'step':
        scopeData = context.variables.step;
        break;
      case 'computed':
        scopeData = context.variables.computed;
        break;
      case 'trigger':
        scopeData = context.triggerData;
        break;
      case 'metadata':
        scopeData = context.metadata;
        break;
      default:
        throw new Error(`Unknown variable scope: ${parsed.scope}`);
    }

    if (!parsed.path) {
      return scopeData;
    }

    return this.getNestedValue(scopeData, parsed.path);
  }

  private getNestedValue(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    return path.split('.').reduce((current, key) => {
      // Handle array indices
      if (key.includes('[') && key.includes(']')) {
        const match = key.match(/^([^[]+)\\[(.+)\\]$/);
        if (match) {
          const [, property, indexStr] = match;
          const index = this.parseArrayIndex(indexStr);
          
          if (property) {
            current = current?.[property];
          }
          
          return Array.isArray(current) ? current[index] : undefined;
        }
      }
      
      return current?.[key];
    }, obj);
  }

  private parseArrayIndex(indexStr: string): number {
    // Handle negative indices
    const index = parseInt(indexStr, 10);
    if (isNaN(index)) {
      throw new Error(`Invalid array index: ${indexStr}`);
    }
    return index;
  }

  private applyTransforms(value: any, transforms: string[], context: ResolverContext): any {
    return transforms.reduce((currentValue, transform) => {
      const [transformName, ...args] = transform.split(':');
      const transformer = context.functions[transformName] || this.transformerRegistry.get(transformName);
      
      if (!transformer) {
        throw new Error(`Unknown transformer: ${transformName}`);
      }

      try {
        return transformer(currentValue, ...args);
      } catch (error) {
        throw new Error(`Error applying transform '${transformName}': ${error.message}`);
      }
    }, value);
  }

  private async processTemplate(
    template: string,
    context: ResolverContext,
    options: ResolverOptions
  ): Promise<string> {
    const cacheKey = `template:${this.hashString(template)}`;
    
    let compiledTemplate: Function;
    if (this.cacheEnabled && this.templateCache.has(cacheKey)) {
      compiledTemplate = this.templateCache.get(cacheKey)!;
    } else {
      compiledTemplate = this.compileTemplate(template);
      if (this.cacheEnabled) {
        this.templateCache.set(cacheKey, compiledTemplate);
      }
    }

    try {
      return await compiledTemplate(context, options);
    } catch (error) {
      if (options.throwOnMissing) {
        throw error;
      }
      return template; // Return original template on error
    }
  }

  private compileTemplate(template: string): Function {
    return async (context: ResolverContext, options: ResolverOptions): Promise<string> => {
      return template.replace(/\\{\\{([^}]+)\\}\\}/g, (match, expression) => {
        try {
          const value = this.evaluateExpression(expression.trim(), context);
          return this.formatValue(value);
        } catch (error) {
          if (options.throwOnMissing) {
            throw error;
          }
          return match; // Return original if evaluation fails
        }
      });
    };
  }

  private evaluateExpression(expression: string, context: ResolverContext): any {
    // Handle variable references
    if (expression.startsWith('$')) {
      const parsed = this.parseVariableReference(expression);
      const value = this.getVariableValue(parsed, context);
      return this.applyTransforms(value, parsed.transforms, context);
    }

    // Handle function calls
    if (expression.includes('(')) {
      return this.evaluateFunction(expression, context);
    }

    // Handle direct property access from trigger data
    if (expression.includes('.')) {
      return this.getNestedValue(context.triggerData, expression);
    }

    // Direct property
    return context.triggerData[expression];
  }

  private evaluateFunction(expression: string, context: ResolverContext): any {
    const match = expression.match(/^(\\w+)\\(([^)]*)\\)$/);
    if (!match) {
      throw new Error(`Invalid function expression: ${expression}`);
    }

    const [, functionName, argsStr] = match;
    const func = context.functions[functionName];
    
    if (!func) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    const args = argsStr ? this.parseArguments(argsStr, context) : [];
    
    try {
      return func(...args);
    } catch (error) {
      throw new Error(`Error calling function ${functionName}: ${error.message}`);
    }
  }

  private parseArguments(argsStr: string, context: ResolverContext): any[] {
    const args: any[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && argsStr[i - 1] !== '\\\\') {
        inString = false;
        stringChar = '';
      } else if (!inString && char === '(') {
        depth++;
      } else if (!inString && char === ')') {
        depth--;
      } else if (!inString && char === ',' && depth === 0) {
        args.push(this.parseArgument(current.trim(), context));
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      args.push(this.parseArgument(current.trim(), context));
    }

    return args;
  }

  private parseArgument(arg: string, context: ResolverContext): any {
    // String literals
    if ((arg.startsWith('"') && arg.endsWith('"')) || 
        (arg.startsWith("'") && arg.endsWith("'"))) {
      return arg.slice(1, -1);
    }

    // Numbers
    if (/^-?\\d+\\.?\\d*$/.test(arg)) {
      return parseFloat(arg);
    }

    // Booleans and null
    if (arg === 'true') return true;
    if (arg === 'false') return false;
    if (arg === 'null') return null;
    if (arg === 'undefined') return undefined;

    // Variable reference or expression
    return this.evaluateExpression(arg, context);
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private validateVariableType(value: any, expectedType: string): string | null {
    switch (expectedType) {
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
      case 'array':
        if (!Array.isArray(value)) {
          return `Expected array, got ${typeof value}`;
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `Expected object, got ${typeof value}`;
        }
        break;
      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return `Expected date, got ${typeof value}`;
        }
        break;
      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return `Expected valid email address`;
        }
        break;
      case 'url':
        if (typeof value !== 'string' || !this.isValidUrl(value)) {
          return `Expected valid URL`;
        }
        break;
    }

    return null;
  }

  private async validateVariableRules(
    value: any,
    rules: AutomationVariable['validation'],
    variableName: string
  ): Promise<string | null> {
    if (!rules) return null;

    // Min/Max validation
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        return `Variable '${variableName}' must be at least ${rules.min}`;
      }
      if (rules.max !== undefined && value > rules.max) {
        return `Variable '${variableName}' must be at most ${rules.max}`;
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (rules.min !== undefined && value.length < rules.min) {
        return `Variable '${variableName}' must be at least ${rules.min} characters`;
      }
      if (rules.max !== undefined && value.length > rules.max) {
        return `Variable '${variableName}' must be at most ${rules.max} characters`;
      }
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string') {
      try {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(value)) {
          return `Variable '${variableName}' does not match required pattern`;
        }
      } catch (error) {
        return `Invalid pattern for variable '${variableName}'`;
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      return `Variable '${variableName}' must be one of: ${rules.enum.join(', ')}`;
    }

    // Custom validation
    if (rules.custom) {
      const customValidator = this.validatorRegistry.get(rules.custom);
      if (customValidator) {
        try {
          const isValid = await customValidator(value);
          if (!isValid) {
            return `Variable '${variableName}' failed custom validation`;
          }
        } catch (error) {
          return `Custom validation error for '${variableName}': ${error.message}`;
        }
      }
    }

    return null;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getBuiltInFunctions(): Record<string, Function> {
    return {
      // String functions
      upper: (str: any) => String(str).toUpperCase(),
      lower: (str: any) => String(str).toLowerCase(),
      trim: (str: any) => String(str).trim(),
      length: (str: any) => String(str).length,
      substring: (str: any, start: number, end?: number) => String(str).substring(start, end),
      replace: (str: any, search: string, replacement: string) => String(str).replace(search, replacement),

      // Math functions
      abs: (num: any) => Math.abs(Number(num)),
      round: (num: any) => Math.round(Number(num)),
      floor: (num: any) => Math.floor(Number(num)),
      ceil: (num: any) => Math.ceil(Number(num)),
      min: (...nums: any[]) => Math.min(...nums.map(n => Number(n))),
      max: (...nums: any[]) => Math.max(...nums.map(n => Number(n))),

      // Date functions
      now: () => new Date().toISOString(),
      today: () => new Date().toISOString().split('T')[0],
      formatDate: (date: any, format: string = 'ISO') => {
        const d = new Date(date);
        switch (format) {
          case 'ISO': return d.toISOString();
          case 'date': return d.toISOString().split('T')[0];
          case 'time': return d.toTimeString().split(' ')[0];
          default: return d.toISOString();
        }
      },

      // Array functions
      join: (arr: any, separator: string = ',') => Array.isArray(arr) ? arr.join(separator) : String(arr),
      first: (arr: any) => Array.isArray(arr) ? arr[0] : undefined,
      last: (arr: any) => Array.isArray(arr) ? arr[arr.length - 1] : undefined,
      count: (arr: any) => Array.isArray(arr) ? arr.length : 0,

      // Utility functions
      default: (value: any, defaultValue: any) => (value !== undefined && value !== null) ? value : defaultValue,
      coalesce: (...values: any[]) => values.find(v => v !== undefined && v !== null),
      json: (obj: any) => JSON.stringify(obj),
      base64: (str: any) => Buffer.from(String(str)).toString('base64'),
      uuid: () => crypto.randomUUID()
    };
  }

  private registerBuiltInTransformers(): void {
    // String transformers
    this.transformerRegistry.set('upper', (value: any) => String(value).toUpperCase());
    this.transformerRegistry.set('lower', (value: any) => String(value).toLowerCase());
    this.transformerRegistry.set('trim', (value: any) => String(value).trim());
    this.transformerRegistry.set('truncate', (value: any, length: number) => String(value).substring(0, Number(length)));

    // Number transformers
    this.transformerRegistry.set('number', (value: any) => Number(value));
    this.transformerRegistry.set('round', (value: any) => Math.round(Number(value)));
    this.transformerRegistry.set('abs', (value: any) => Math.abs(Number(value)));

    // Array transformers
    this.transformerRegistry.set('join', (value: any, separator: string = ',') => 
      Array.isArray(value) ? value.join(separator) : String(value)
    );
    this.transformerRegistry.set('first', (value: any) => Array.isArray(value) ? value[0] : value);
    this.transformerRegistry.set('last', (value: any) => Array.isArray(value) ? value[value.length - 1] : value);

    // Format transformers
    this.transformerRegistry.set('json', (value: any) => JSON.stringify(value));
    this.transformerRegistry.set('base64', (value: any) => Buffer.from(String(value)).toString('base64'));
    this.transformerRegistry.set('url', (value: any) => encodeURIComponent(String(value)));

    // Default transformer
    this.transformerRegistry.set('default', (value: any, defaultValue: any) => 
      (value !== undefined && value !== null) ? value : defaultValue
    );
  }

  private registerBuiltInValidators(): void {
    this.validatorRegistry.set('email', (value: any) => this.isValidEmail(String(value)));
    this.validatorRegistry.set('url', (value: any) => this.isValidUrl(String(value)));
    this.validatorRegistry.set('uuid', (value: any) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(String(value));
    });
    this.validatorRegistry.set('not_empty', (value: any) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      return String(value).trim().length > 0;
    });
  }
}