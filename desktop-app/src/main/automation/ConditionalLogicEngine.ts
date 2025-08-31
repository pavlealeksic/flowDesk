/**
 * Conditional Logic Engine - Advanced rule evaluation system
 * 
 * This engine provides:
 * - Complex conditional logic evaluation
 * - Support for nested conditions with AND/OR logic
 * - Variable and context-aware evaluations
 * - Pattern matching and regular expressions
 * - Dynamic rule compilation and caching
 */

import { 
  AutomationCondition,
  ConditionOperator,
  AutomationVariableContext 
} from '@flow-desk/shared';

interface EvaluationContext {
  data: any;
  variables: AutomationVariableContext;
  functions: Record<string, Function>;
  metadata: {
    timestamp: Date;
    executionId: string;
    userId: string;
  };
}

interface CompiledCondition {
  id: string;
  condition: AutomationCondition;
  evaluator: (context: EvaluationContext) => boolean;
  dependencies: string[];
  cached: boolean;
}

export class ConditionalLogicEngine {
  private readonly compiledConditions = new Map<string, CompiledCondition>();
  private readonly functionRegistry = new Map<string, Function>();
  private readonly operatorHandlers = new Map<ConditionOperator, Function>();

  constructor() {
    this.registerBuiltInOperators();
    this.registerBuiltInFunctions();
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(
    condition: AutomationCondition,
    data: any,
    variables: AutomationVariableContext = { global: {}, recipe: {}, execution: {}, step: {}, computed: {} }
  ): boolean {
    const context: EvaluationContext = {
      data,
      variables,
      functions: Object.fromEntries(this.functionRegistry),
      metadata: {
        timestamp: new Date(),
        executionId: 'current',
        userId: 'current'
      }
    };

    return this.evaluateConditionWithContext(condition, context);
  }

  /**
   * Evaluate multiple conditions with logical operators
   */
  evaluateConditions(
    conditions: AutomationCondition[],
    data: any,
    variables: AutomationVariableContext = { global: {}, recipe: {}, execution: {}, step: {}, computed: {} }
  ): boolean {
    if (conditions.length === 0) return true;

    const context: EvaluationContext = {
      data,
      variables,
      functions: Object.fromEntries(this.functionRegistry),
      metadata: {
        timestamp: new Date(),
        executionId: 'current',
        userId: 'current'
      }
    };

    return this.evaluateConditionGroup(conditions, context);
  }

  /**
   * Compile a condition for repeated evaluation (performance optimization)
   */
  compileCondition(condition: AutomationCondition): string {
    const conditionId = this.generateConditionId(condition);
    
    if (this.compiledConditions.has(conditionId)) {
      return conditionId;
    }

    const evaluator = this.createEvaluator(condition);
    const dependencies = this.extractDependencies(condition);

    const compiled: CompiledCondition = {
      id: conditionId,
      condition,
      evaluator,
      dependencies,
      cached: false
    };

    this.compiledConditions.set(conditionId, compiled);
    return conditionId;
  }

  /**
   * Evaluate a compiled condition
   */
  evaluateCompiledCondition(
    conditionId: string,
    data: any,
    variables: AutomationVariableContext
  ): boolean {
    const compiled = this.compiledConditions.get(conditionId);
    if (!compiled) {
      throw new Error(`Compiled condition not found: ${conditionId}`);
    }

    const context: EvaluationContext = {
      data,
      variables,
      functions: Object.fromEntries(this.functionRegistry),
      metadata: {
        timestamp: new Date(),
        executionId: 'current',
        userId: 'current'
      }
    };

    return compiled.evaluator(context);
  }

  /**
   * Register a custom function for use in conditions
   */
  registerFunction(name: string, func: Function): void {
    this.functionRegistry.set(name, func);
  }

  /**
   * Register a custom operator
   */
  registerOperator(operator: string, handler: Function): void {
    this.operatorHandlers.set(operator as ConditionOperator, handler);
  }

  // Private methods

  private evaluateConditionWithContext(
    condition: AutomationCondition,
    context: EvaluationContext
  ): boolean {
    // Handle nested conditions
    if (condition.conditions && condition.conditions.length > 0) {
      return this.evaluateConditionGroup(condition.conditions, context, condition.logic || 'AND');
    }

    // Resolve field value
    const fieldValue = this.resolveFieldValue(condition.field, context);
    const expectedValue = this.resolveValue(condition.value, context);

    // Get operator handler
    const operatorHandler = this.operatorHandlers.get(condition.operator);
    if (!operatorHandler) {
      throw new Error(`Unsupported operator: ${condition.operator}`);
    }

    try {
      return operatorHandler(fieldValue, expectedValue, context);
    } catch (error) {
      throw new Error(`Error evaluating condition: ${error.message}`);
    }
  }

  private evaluateConditionGroup(
    conditions: AutomationCondition[],
    context: EvaluationContext,
    logic: 'AND' | 'OR' = 'AND'
  ): boolean {
    if (conditions.length === 0) return true;

    const results = conditions.map(condition => this.evaluateConditionWithContext(condition, context));

    if (logic === 'OR') {
      return results.some(result => result);
    } else {
      return results.every(result => result);
    }
  }

  private resolveFieldValue(field: string, context: EvaluationContext): any {
    // Handle variable references
    if (field.startsWith('$')) {
      return this.resolveVariableReference(field, context);
    }

    // Handle function calls
    if (field.includes('(')) {
      return this.evaluateFunction(field, context);
    }

    // Handle dot notation
    if (field.includes('.')) {
      return this.resolveNestedProperty(field, context.data);
    }

    // Direct property access
    return context.data[field];
  }

  private resolveValue(value: any, context: EvaluationContext): any {
    if (typeof value === 'string') {
      // Handle variable references
      if (value.startsWith('$')) {
        return this.resolveVariableReference(value, context);
      }

      // Handle template strings
      if (value.includes('{{') && value.includes('}}')) {
        return this.evaluateTemplate(value, context);
      }

      // Handle function calls
      if (value.includes('(')) {
        return this.evaluateFunction(value, context);
      }
    }

    return value;
  }

  private resolveVariableReference(reference: string, context: EvaluationContext): any {
    const varPath = reference.substring(1); // Remove $ prefix
    const [scope, ...pathParts] = varPath.split('.');
    const path = pathParts.join('.');

    let scopeData: any;
    switch (scope) {
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
        scopeData = context.data;
        break;
      case 'metadata':
        scopeData = context.metadata;
        break;
      default:
        throw new Error(`Unknown variable scope: ${scope}`);
    }

    if (!path) {
      return scopeData;
    }

    return this.resolveNestedProperty(path, scopeData);
  }

  private resolveNestedProperty(path: string, object: any): any {
    if (!object || typeof object !== 'object') {
      return undefined;
    }

    return path.split('.').reduce((obj, key) => {
      // Handle array indices
      if (key.includes('[') && key.includes(']')) {
        const [property, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''), 10);
        
        if (property) {
          obj = obj?.[property];
        }
        
        return Array.isArray(obj) ? obj[index] : undefined;
      }
      
      return obj?.[key];
    }, object);
  }

  private evaluateTemplate(template: string, context: EvaluationContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        const value = this.resolveFieldValue(expression.trim(), context);
        return String(value ?? '');
      } catch (error) {
        return match; // Return original if evaluation fails
      }
    });
  }

  private evaluateFunction(expression: string, context: EvaluationContext): any {
    const match = expression.match(/^(\w+)\(([^)]*)\)$/);
    if (!match) {
      throw new Error(`Invalid function expression: ${expression}`);
    }

    const [, functionName, argsStr] = match;
    const func = context.functions[functionName];
    
    if (!func) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    // Parse arguments
    const args = argsStr ? this.parseArguments(argsStr, context) : [];
    
    try {
      return func(...args);
    } catch (error) {
      throw new Error(`Error calling function ${functionName}: ${error.message}`);
    }
  }

  private parseArguments(argsStr: string, context: EvaluationContext): any[] {
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
        current += char;
      } else if (inString && char === stringChar && argsStr[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
        current += char;
      } else if (!inString && char === '(') {
        depth++;
        current += char;
      } else if (!inString && char === ')') {
        depth--;
        current += char;
      } else if (!inString && char === ',' && depth === 0) {
        args.push(this.parseArgument(current.trim(), context));
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(this.parseArgument(current.trim(), context));
    }

    return args;
  }

  private parseArgument(arg: string, context: EvaluationContext): any {
    // Remove quotes from string literals
    if ((arg.startsWith('"') && arg.endsWith('"')) || 
        (arg.startsWith("'") && arg.endsWith("'"))) {
      return arg.slice(1, -1);
    }

    // Parse numbers
    if (/^-?\d+\.?\d*$/.test(arg)) {
      return parseFloat(arg);
    }

    // Parse booleans
    if (arg === 'true') return true;
    if (arg === 'false') return false;
    if (arg === 'null') return null;
    if (arg === 'undefined') return undefined;

    // Resolve as expression
    return this.resolveFieldValue(arg, context);
  }

  private createEvaluator(condition: AutomationCondition): (context: EvaluationContext) => boolean {
    // Create a compiled evaluator function for better performance
    return (context: EvaluationContext) => this.evaluateConditionWithContext(condition, context);
  }

  private extractDependencies(condition: AutomationCondition): string[] {
    const dependencies: string[] = [];

    // Extract field dependencies
    if (condition.field) {
      dependencies.push(condition.field);
    }

    // Extract value dependencies
    if (typeof condition.value === 'string' && condition.value.startsWith('$')) {
      dependencies.push(condition.value);
    }

    // Extract nested condition dependencies
    if (condition.conditions) {
      for (const nested of condition.conditions) {
        dependencies.push(...this.extractDependencies(nested));
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  private generateConditionId(condition: AutomationCondition): string {
    const conditionStr = JSON.stringify(condition, Object.keys(condition).sort());
    return `condition_${this.hashString(conditionStr)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private registerBuiltInOperators(): void {
    // Equality operators
    this.operatorHandlers.set('equals', (a: any, b: any) => a === b);
    this.operatorHandlers.set('not_equals', (a: any, b: any) => a !== b);

    // Comparison operators
    this.operatorHandlers.set('greater_than', (a: any, b: any) => Number(a) > Number(b));
    this.operatorHandlers.set('greater_than_or_equal', (a: any, b: any) => Number(a) >= Number(b));
    this.operatorHandlers.set('less_than', (a: any, b: any) => Number(a) < Number(b));
    this.operatorHandlers.set('less_than_or_equal', (a: any, b: any) => Number(a) <= Number(b));

    // String operators
    this.operatorHandlers.set('contains', (a: any, b: any) => 
      String(a).toLowerCase().includes(String(b).toLowerCase())
    );
    this.operatorHandlers.set('not_contains', (a: any, b: any) => 
      !String(a).toLowerCase().includes(String(b).toLowerCase())
    );
    this.operatorHandlers.set('starts_with', (a: any, b: any) => 
      String(a).toLowerCase().startsWith(String(b).toLowerCase())
    );
    this.operatorHandlers.set('ends_with', (a: any, b: any) => 
      String(a).toLowerCase().endsWith(String(b).toLowerCase())
    );

    // Array operators
    this.operatorHandlers.set('in', (a: any, b: any) => {
      if (Array.isArray(b)) {
        return b.includes(a);
      }
      return String(b).includes(String(a));
    });
    this.operatorHandlers.set('not_in', (a: any, b: any) => {
      if (Array.isArray(b)) {
        return !b.includes(a);
      }
      return !String(b).includes(String(a));
    });

    // Existence operators
    this.operatorHandlers.set('exists', (a: any) => a !== undefined && a !== null);
    this.operatorHandlers.set('not_exists', (a: any) => a === undefined || a === null);

    // Empty/null operators
    this.operatorHandlers.set('is_empty', (a: any) => {
      if (a === null || a === undefined) return true;
      if (Array.isArray(a)) return a.length === 0;
      if (typeof a === 'object') return Object.keys(a).length === 0;
      return String(a).trim() === '';
    });
    this.operatorHandlers.set('is_not_empty', (a: any) => {
      if (a === null || a === undefined) return false;
      if (Array.isArray(a)) return a.length > 0;
      if (typeof a === 'object') return Object.keys(a).length > 0;
      return String(a).trim() !== '';
    });

    // Regular expression operator
    this.operatorHandlers.set('regex', (a: any, b: any) => {
      try {
        const regex = new RegExp(String(b), 'i');
        return regex.test(String(a));
      } catch (error) {
        throw new Error(`Invalid regex pattern: ${b}`);
      }
    });
  }

  private registerBuiltInFunctions(): void {
    // String functions
    this.functionRegistry.set('length', (str: any) => String(str).length);
    this.functionRegistry.set('upper', (str: any) => String(str).toUpperCase());
    this.functionRegistry.set('lower', (str: any) => String(str).toLowerCase());
    this.functionRegistry.set('trim', (str: any) => String(str).trim());
    this.functionRegistry.set('substring', (str: any, start: number, end?: number) => 
      String(str).substring(start, end)
    );

    // Math functions
    this.functionRegistry.set('abs', (num: any) => Math.abs(Number(num)));
    this.functionRegistry.set('round', (num: any) => Math.round(Number(num)));
    this.functionRegistry.set('floor', (num: any) => Math.floor(Number(num)));
    this.functionRegistry.set('ceil', (num: any) => Math.ceil(Number(num)));
    this.functionRegistry.set('min', (...nums: any[]) => Math.min(...nums.map(n => Number(n))));
    this.functionRegistry.set('max', (...nums: any[]) => Math.max(...nums.map(n => Number(n))));

    // Date functions
    this.functionRegistry.set('now', () => new Date());
    this.functionRegistry.set('today', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    });
    this.functionRegistry.set('dateAdd', (date: any, amount: number, unit: string) => {
      const d = new Date(date);
      switch (unit) {
        case 'days':
          d.setDate(d.getDate() + amount);
          break;
        case 'hours':
          d.setHours(d.getHours() + amount);
          break;
        case 'minutes':
          d.setMinutes(d.getMinutes() + amount);
          break;
        case 'seconds':
          d.setSeconds(d.getSeconds() + amount);
          break;
      }
      return d;
    });

    // Array functions
    this.functionRegistry.set('count', (arr: any) => Array.isArray(arr) ? arr.length : 0);
    this.functionRegistry.set('first', (arr: any) => Array.isArray(arr) ? arr[0] : undefined);
    this.functionRegistry.set('last', (arr: any) => Array.isArray(arr) ? arr[arr.length - 1] : undefined);
    this.functionRegistry.set('join', (arr: any, separator: string = ',') => 
      Array.isArray(arr) ? arr.join(separator) : String(arr)
    );

    // Type checking functions
    this.functionRegistry.set('isString', (value: any) => typeof value === 'string');
    this.functionRegistry.set('isNumber', (value: any) => typeof value === 'number' && !isNaN(value));
    this.functionRegistry.set('isBoolean', (value: any) => typeof value === 'boolean');
    this.functionRegistry.set('isArray', (value: any) => Array.isArray(value));
    this.functionRegistry.set('isObject', (value: any) => typeof value === 'object' && value !== null && !Array.isArray(value));
    this.functionRegistry.set('isEmpty', (value: any) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return String(value).trim() === '';
    });
  }
}