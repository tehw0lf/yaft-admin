import { Injectable } from '@angular/core';
import { Feature, FeatureWithSecret } from '../models/feature.model';

export interface ExportData {
  timestamp: string;
  version: string;
  features: Feature[];
}

export interface ImportResult {
  success: boolean;
  features: Feature[];
  errors: string[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private readonly EXPORT_VERSION = '1.0';

  exportToJson(features: FeatureWithSecret[]): void {
    const exportData: ExportData = {
      timestamp: new Date().toISOString(),
      version: this.EXPORT_VERSION,
      features: features
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yaft-features-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
  }

  exportBooleanJson(booleanData: Record<string, boolean>): void {
    const blob = new Blob([JSON.stringify(booleanData, null, 2)], {
      type: 'application/json'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yaft-boolean-toggles-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
  }

  exportToCsv(features: FeatureWithSecret[]): void {
    const headers = ['Key', 'Value', 'ActiveAt', 'DisabledAt', 'HasSecret'];
    const csvContent = [
      headers.join(','),
      ...features.map(feature => [
        this.escapeCsvField(feature.key),
        this.escapeCsvField(feature.value),
        this.escapeCsvField(feature.activeAt || ''),
        this.escapeCsvField(feature.disabledAt || ''),
        this.escapeCsvField(feature.secret ? 'true' : 'false')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yaft-features-${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
  }

  exportBooleanCsv(features: Feature[]): void {
    const headers = ['Key', 'Value'];
    const csvContent = [
      headers.join(','),
      ...features.map(feature => [
        this.escapeCsvField(feature.key),
        this.escapeCsvField(feature.value === 'true' ? 'true' : 'false')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yaft-boolean-toggles-${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
  }

  async importFromFile(file: File): Promise<ImportResult> {
    try {
      const fileContent = await this.readFileAsText(file);
      
      if (file.name.toLowerCase().endsWith('.json')) {
        return this.importFromJson(fileContent);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        return this.importFromCsv(fileContent);
      } else {
        return {
          success: false,
          features: [],
          errors: ['Unsupported file format. Please use JSON or CSV files.'],
          warnings: []
        };
      }
    } catch (error) {
      return {
        success: false,
        features: [],
        errors: [`Failed to read file: ${error}`],
        warnings: []
      };
    }
  }

  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  private importFromJson(content: string): ImportResult {
    const result: ImportResult = {
      success: false,
      features: [],
      errors: [],
      warnings: []
    };

    try {
      const data = JSON.parse(content);
      
      // Check if it's our export format
      if (data.features && Array.isArray(data.features)) {
        result.features = data.features;
        
        if (data.version && data.version !== this.EXPORT_VERSION) {
          result.warnings.push(`Import version (${data.version}) differs from current version (${this.EXPORT_VERSION})`);
        }
      } else if (Array.isArray(data)) {
        // Direct array of features
        result.features = data;
      } else if (typeof data === 'object' && data !== null) {
        // Object format - convert to feature array
        result.features = this.convertObjectToFeatures(data);
        if (result.features.length === 0) {
          result.warnings.push('No valid features found in object format');
        }
      } else {
        result.errors.push('Invalid JSON format. Expected array of features, export format, or object with feature keys.');
        return result;
      }

      // Validate features
      const validationResult = this.validateFeatures(result.features);
      result.features = validationResult.validFeatures;
      result.errors.push(...validationResult.errors);
      result.warnings.push(...validationResult.warnings);

      result.success = result.features.length > 0;
      
    } catch (error) {
      result.errors.push(`Invalid JSON format: ${error}`);
    }

    return result;
  }

  private importFromCsv(content: string): ImportResult {
    const result: ImportResult = {
      success: false,
      features: [],
      errors: [],
      warnings: []
    };

    try {
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        result.errors.push('CSV file must contain at least a header row and one data row');
        return result;
      }

      const headers = this.parseCsvLine(lines[0]);
      const features: Feature[] = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCsvLine(lines[i]);
          const feature: Feature = {
            key: values[0] || '',
            value: values[1] || 'false',
            activeAt: values[2] || null,
            disabledAt: values[3] || null,
          };

          if (feature.key) {
            features.push(feature);
          } else {
            result.warnings.push(`Skipping row ${i + 1}: Missing key`);
          }
        } catch (error) {
          result.warnings.push(`Error parsing row ${i + 1}: ${error}`);
        }
      }

      const validationResult = this.validateFeatures(features);
      result.features = validationResult.validFeatures;
      result.errors.push(...validationResult.errors);
      result.warnings.push(...validationResult.warnings);

      result.success = result.features.length > 0;

    } catch (error) {
      result.errors.push(`Invalid CSV format: ${error}`);
    }

    return result;
  }

  private validateFeatures(features: any[]): {
    validFeatures: Feature[];
    errors: string[];
    warnings: string[];
  } {
    const validFeatures: Feature[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenKeys = new Set<string>();

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      
      // Check required fields
      if (!feature.key || typeof feature.key !== 'string') {
        warnings.push(`Feature ${i + 1}: Missing or invalid key, skipping`);
        continue;
      }

      // Check for duplicate keys
      if (seenKeys.has(feature.key)) {
        warnings.push(`Feature ${i + 1}: Duplicate key '${feature.key}', skipping`);
        continue;
      }
      seenKeys.add(feature.key);

      // Validate and clean feature
      const cleanedFeature: Feature = {
        key: feature.key.trim(),
        value: feature.value === 'true' || feature.value === true ? 'true' : 'false',
        activeAt: this.validateAndCleanDate(feature.activeAt),
        disabledAt: this.validateAndCleanDate(feature.disabledAt),
      };

      // Validate time range
      if (cleanedFeature.activeAt && cleanedFeature.disabledAt) {
        const activeDate = new Date(cleanedFeature.activeAt);
        const disabledDate = new Date(cleanedFeature.disabledAt);
        
        if (activeDate >= disabledDate) {
          warnings.push(`Feature '${cleanedFeature.key}': Active time must be before disabled time`);
        }
      }

      validFeatures.push(cleanedFeature);
    }

    return { validFeatures, errors, warnings };
  }

  private validateAndCleanDate(date: any): string | null {
    if (!date) return null;
    
    try {
      const parsedDate = new Date(date);
      return isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
    } catch {
      return null;
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result.map(field => field.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"'));
  }

  private convertObjectToFeatures(data: any): Feature[] {
    const features: Feature[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      try {
        if (typeof value === 'boolean' || value === 'true' || value === 'false') {
          // Boolean format: { "toggleName": true }
          features.push({
            key: key,
            value: value === true || value === 'true' ? 'true' : 'false',
            activeAt: null,
            disabledAt: null,
          });
        } else if (typeof value === 'object' && value !== null) {
          // Feature object format: { "toggleName": { key: "toggleName", value: "true", ... } }
          const featureObj = value as any;
          features.push({
            key: featureObj.key || key,
            value: featureObj.value === true || featureObj.value === 'true' ? 'true' : 'false',
            activeAt: featureObj.activeAt || null,
            disabledAt: featureObj.disabledAt || null,
          });
        }
      } catch (error) {
        console.warn(`Failed to convert feature '${key}':`, error);
      }
    }
    
    return features;
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}