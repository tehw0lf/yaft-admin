import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { 
  FeatureTemplate, 
  TemplateCategory, 
  TemplateUsage, 
  TemplateVariable,
  BUILT_IN_TEMPLATES,
  TEMPLATE_CATEGORIES
} from '../models/template.model';
import { Feature } from '../models/feature.model';
import { ErrorHandlerService } from './error-handler.service';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private templatesSubject = new BehaviorSubject<FeatureTemplate[]>([]);
  private usageHistorySubject = new BehaviorSubject<TemplateUsage[]>([]);
  
  public templates$ = this.templatesSubject.asObservable();
  public usageHistory$ = this.usageHistorySubject.asObservable();

  constructor(private errorHandler: ErrorHandlerService) {
    this.initializeTemplates();
    this.loadUsageHistory();
  }

  // Initialize templates from built-ins and localStorage
  private initializeTemplates(): void {
    const customTemplates = this.loadCustomTemplates();
    const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];
    this.templatesSubject.next(allTemplates);
  }

  // Load custom templates from localStorage
  private loadCustomTemplates(): FeatureTemplate[] {
    try {
      const stored = localStorage.getItem('yaft-custom-templates');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load custom templates:', error);
      return [];
    }
  }

  // Save custom templates to localStorage
  private saveCustomTemplates(): void {
    const allTemplates = this.templatesSubject.value;
    const customTemplates = allTemplates.filter(t => !t.isBuiltIn);
    localStorage.setItem('yaft-custom-templates', JSON.stringify(customTemplates));
  }

  // Load usage history from localStorage
  private loadUsageHistory(): void {
    try {
      const stored = localStorage.getItem('yaft-template-usage');
      const usageHistory = stored ? JSON.parse(stored) : [];
      this.usageHistorySubject.next(usageHistory);
    } catch (error) {
      console.error('Failed to load usage history:', error);
    }
  }

  // Save usage history to localStorage
  private saveUsageHistory(): void {
    const history = this.usageHistorySubject.value;
    localStorage.setItem('yaft-template-usage', JSON.stringify(history));
  }

  // Get all templates
  getAllTemplates(): FeatureTemplate[] {
    return this.templatesSubject.value;
  }

  // Get templates by category
  getTemplatesByCategory(category: string): FeatureTemplate[] {
    return this.templatesSubject.value.filter(t => t.category === category);
  }

  // Get template by ID
  getTemplate(id: string): FeatureTemplate | undefined {
    return this.templatesSubject.value.find(t => t.id === id);
  }

  // Get template categories
  getCategories(): TemplateCategory[] {
    return TEMPLATE_CATEGORIES;
  }

  // Create new custom template
  createTemplate(template: Omit<FeatureTemplate, 'id' | 'createdAt' | 'usageCount' | 'isBuiltIn'>): Observable<FeatureTemplate> {
    const newTemplate: FeatureTemplate = {
      ...template,
      id: this.generateTemplateId(),
      createdAt: new Date(),
      usageCount: 0,
      isBuiltIn: false
    };

    const currentTemplates = this.templatesSubject.value;
    const updatedTemplates = [...currentTemplates, newTemplate];
    
    this.templatesSubject.next(updatedTemplates);
    this.saveCustomTemplates();
    
    this.errorHandler.showSuccessNotification(`Template "${newTemplate.name}" created successfully`);
    return of(newTemplate);
  }

  // Update existing template (only custom templates)
  updateTemplate(id: string, updates: Partial<FeatureTemplate>): Observable<FeatureTemplate> {
    const templates = this.templatesSubject.value;
    const templateIndex = templates.findIndex(t => t.id === id);
    
    if (templateIndex === -1) {
      throw new Error('Template not found');
    }
    
    const template = templates[templateIndex];
    if (template.isBuiltIn) {
      throw new Error('Cannot update built-in templates');
    }

    const updatedTemplate = { ...template, ...updates };
    const updatedTemplates = [...templates];
    updatedTemplates[templateIndex] = updatedTemplate;

    this.templatesSubject.next(updatedTemplates);
    this.saveCustomTemplates();
    
    this.errorHandler.showSuccessNotification(`Template "${updatedTemplate.name}" updated successfully`);
    return of(updatedTemplate);
  }

  // Delete custom template
  deleteTemplate(id: string): Observable<void> {
    const templates = this.templatesSubject.value;
    const template = templates.find(t => t.id === id);
    
    if (!template) {
      throw new Error('Template not found');
    }
    
    if (template.isBuiltIn) {
      throw new Error('Cannot delete built-in templates');
    }

    const updatedTemplates = templates.filter(t => t.id !== id);
    this.templatesSubject.next(updatedTemplates);
    this.saveCustomTemplates();
    
    this.errorHandler.showSuccessNotification(`Template "${template.name}" deleted successfully`);
    return of(void 0);
  }

  // Create feature from template
  createFeatureFromTemplate(
    templateId: string, 
    variables: { [key: string]: any }
  ): Feature {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Process template variables
    const processedKey = this.processTemplate(template.keyTemplate, variables);
    const processedTags = template.tags.map(tag => this.processTemplate(tag, variables));

    // Create feature object
    const feature: Feature = {
      key: processedKey,
      value: template.value,
      tags: processedTags,
      activeAt: variables.activation_date ? new Date(variables.activation_date).toISOString() : template.activeAt,
      disabledAt: variables.maintenance_end ? new Date(variables.maintenance_end).toISOString() : template.disabledAt
    };

    // Record usage
    this.recordTemplateUsage(templateId, processedKey, variables);
    
    // Increment usage count
    this.incrementUsageCount(templateId);

    return feature;
  }

  // Process template string with variables
  private processTemplate(template: string, variables: { [key: string]: any }): string {
    let result = template;
    
    // Replace {{variable}} patterns
    Object.keys(variables).forEach(key => {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(pattern, String(variables[key]));
    });
    
    return result;
  }

  // Validate template variables
  validateTemplateVariables(template: FeatureTemplate, variables: { [key: string]: any }): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!template.variables) {
      return { isValid: true, errors: [] };
    }

    template.variables.forEach(variable => {
      const value = variables[variable.name];
      
      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push(`${variable.description} is required`);
        return;
      }

      // Skip validation if value is empty and not required
      if (!value && !variable.required) {
        return;
      }

      // Type validation
      switch (variable.type) {
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`${variable.description} must be a number`);
          }
          break;
        
        case 'date':
          if (!Date.parse(value)) {
            errors.push(`${variable.description} must be a valid date`);
          }
          break;
        
        case 'select':
          if (variable.options && !variable.options.includes(value)) {
            errors.push(`${variable.description} must be one of: ${variable.options.join(', ')}`);
          }
          break;
        
        case 'text':
          if (variable.pattern && !new RegExp(variable.pattern).test(value)) {
            errors.push(`${variable.description} format is invalid`);
          }
          break;
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Record template usage
  private recordTemplateUsage(templateId: string, featureKey: string, variables: { [key: string]: any }): void {
    const usage: TemplateUsage = {
      templateId,
      featureKey,
      createdAt: new Date(),
      variables
    };

    const currentHistory = this.usageHistorySubject.value;
    const updatedHistory = [usage, ...currentHistory].slice(0, 100); // Keep last 100 usages
    
    this.usageHistorySubject.next(updatedHistory);
    this.saveUsageHistory();
  }

  // Increment usage count for template
  private incrementUsageCount(templateId: string): void {
    const templates = this.templatesSubject.value;
    const templateIndex = templates.findIndex(t => t.id === templateId);
    
    if (templateIndex !== -1) {
      const template = templates[templateIndex];
      const updatedTemplate = { ...template, usageCount: template.usageCount + 1 };
      const updatedTemplates = [...templates];
      updatedTemplates[templateIndex] = updatedTemplate;
      
      this.templatesSubject.next(updatedTemplates);
      
      if (!template.isBuiltIn) {
        this.saveCustomTemplates();
      }
    }
  }

  // Get most used templates
  getMostUsedTemplates(limit: number = 5): FeatureTemplate[] {
    return [...this.templatesSubject.value]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  // Get recent template usage
  getRecentUsage(limit: number = 10): TemplateUsage[] {
    return this.usageHistorySubject.value.slice(0, limit);
  }

  // Export templates
  exportTemplates(): void {
    const customTemplates = this.templatesSubject.value.filter(t => !t.isBuiltIn);
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      templates: customTemplates
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yaft-templates-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
    
    this.errorHandler.showSuccessNotification('Templates exported successfully');
  }

  // Import templates
  async importTemplates(file: File): Promise<void> {
    try {
      const content = await this.readFileAsText(file);
      const data = JSON.parse(content);
      
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Invalid template file format');
      }

      const importedTemplates = data.templates.map((t: any) => ({
        ...t,
        id: this.generateTemplateId(), // Generate new IDs to avoid conflicts
        isBuiltIn: false,
        createdAt: new Date(),
        usageCount: 0
      }));

      const currentTemplates = this.templatesSubject.value;
      const updatedTemplates = [...currentTemplates, ...importedTemplates];
      
      this.templatesSubject.next(updatedTemplates);
      this.saveCustomTemplates();
      
      this.errorHandler.showSuccessNotification(`Imported ${importedTemplates.length} templates successfully`);
    } catch (error) {
      this.errorHandler.showErrorNotification(`Failed to import templates: ${error}`);
      throw error;
    }
  }

  // Helper methods
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  private generateTemplateId(): string {
    return 'template-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
}