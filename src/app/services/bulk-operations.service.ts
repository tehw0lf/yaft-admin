import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { YaftProviderService } from './yaft-provider.service';
import { ErrorHandlerService } from './error-handler.service';
import { Feature } from '../models/feature.model';

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: string[];
  results: any[];
}

export interface BulkOperationProgress {
  total: number;
  completed: number;
  current: string;
  percentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class BulkOperationsService {
  constructor(
    private yaftService: YaftProviderService,
    private errorHandler: ErrorHandlerService
  ) {}

  // Enable multiple features
  enableFeatures(features: Feature[], progressCallback?: (progress: BulkOperationProgress) => void): Observable<BulkOperationResult> {
    return this.executeBulkOperation(
      features,
      (feature) => this.enableSingleFeature(feature),
      'Enabling',
      progressCallback
    );
  }

  // Disable multiple features
  disableFeatures(features: Feature[], progressCallback?: (progress: BulkOperationProgress) => void): Observable<BulkOperationResult> {
    return this.executeBulkOperation(
      features,
      (feature) => this.disableSingleFeature(feature),
      'Disabling',
      progressCallback
    );
  }

  // Delete multiple features
  deleteFeatures(features: Feature[], progressCallback?: (progress: BulkOperationProgress) => void): Observable<BulkOperationResult> {
    return this.executeBulkOperation(
      features,
      (feature) => this.deleteSingleFeature(feature),
      'Deleting',
      progressCallback
    );
  }

  // Add tags to multiple features
  addTagsToFeatures(features: Feature[], tags: string[], progressCallback?: (progress: BulkOperationProgress) => void): Observable<BulkOperationResult> {
    return this.executeBulkOperation(
      features,
      (feature) => this.addTagsToSingleFeature(feature, tags),
      'Adding tags to',
      progressCallback
    );
  }

  // Remove tags from multiple features
  removeTagsFromFeatures(features: Feature[], tags: string[], progressCallback?: (progress: BulkOperationProgress) => void): Observable<BulkOperationResult> {
    return this.executeBulkOperation(
      features,
      (feature) => this.removeTagsFromSingleFeature(feature, tags),
      'Removing tags from',
      progressCallback
    );
  }

  // Export selected features
  exportFeatures(features: Feature[]): void {
    // This would typically use the ExportService
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      features: features
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selected-features-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);

    this.errorHandler.showSuccessNotification(`Exported ${features.length} selected features`);
  }

  private executeBulkOperation<T>(
    features: Feature[],
    operation: (feature: Feature) => Observable<T>,
    actionName: string,
    progressCallback?: (progress: BulkOperationProgress) => void
  ): Observable<BulkOperationResult> {
    const total = features.length;
    let completed = 0;
    const results: T[] = [];
    const errors: string[] = [];

    if (total === 0) {
      return of({
        success: 0,
        failed: 0,
        errors: [],
        results: []
      });
    }

    // Update progress
    const updateProgress = (current: string) => {
      if (progressCallback) {
        progressCallback({
          total,
          completed,
          current,
          percentage: Math.round((completed / total) * 100)
        });
      }
    };

    // Process features sequentially to avoid overwhelming the API
    return new Observable<BulkOperationResult>(observer => {
      let currentIndex = 0;

      const processNext = () => {
        if (currentIndex >= features.length) {
          // All done
          observer.next({
            success: results.length,
            failed: errors.length,
            errors,
            results
          });
          observer.complete();
          return;
        }

        const feature = features[currentIndex];
        updateProgress(`${actionName} ${feature.key}`);

        operation(feature).subscribe({
          next: (result) => {
            results.push(result);
            completed++;
            currentIndex++;
            updateProgress(`Completed ${feature.key}`);
            
            // Small delay to prevent API rate limiting
            setTimeout(() => processNext(), 100);
          },
          error: (error) => {
            errors.push(`${feature.key}: ${error.message || error}`);
            completed++;
            currentIndex++;
            updateProgress(`Failed ${feature.key}`);
            
            setTimeout(() => processNext(), 100);
          }
        });
      };

      processNext();
    });
  }

  private enableSingleFeature(feature: Feature): Observable<any> {
    if (!feature.secret) {
      return new Observable(observer => {
        observer.error(new Error('No secret available for feature'));
      });
    }

    return this.yaftService.updateFeature(feature.key, { value: 'true' }, feature.secret);
  }

  private disableSingleFeature(feature: Feature): Observable<any> {
    if (!feature.secret) {
      return new Observable(observer => {
        observer.error(new Error('No secret available for feature'));
      });
    }

    return this.yaftService.updateFeature(feature.key, { value: 'false' }, feature.secret);
  }

  private deleteSingleFeature(feature: Feature): Observable<any> {
    if (!feature.secret) {
      return new Observable(observer => {
        observer.error(new Error('No secret available for feature'));
      });
    }

    return this.yaftService.deleteFeature(feature.key, feature.secret);
  }

  private addTagsToSingleFeature(feature: Feature, tagsToAdd: string[]): Observable<any> {
    const currentTags = feature.tags || [];
    const newTags = [...new Set([...currentTags, ...tagsToAdd])];
    
    if (!feature.secret) {
      return new Observable(observer => {
        observer.error(new Error('No secret available for feature'));
      });
    }

    return this.yaftService.updateFeature(feature.key, { tags: newTags }, feature.secret);
  }

  private removeTagsFromSingleFeature(feature: Feature, tagsToRemove: string[]): Observable<any> {
    const currentTags = feature.tags || [];
    const newTags = currentTags.filter(tag => !tagsToRemove.includes(tag));
    
    if (!feature.secret) {
      return new Observable(observer => {
        observer.error(new Error('No secret available for feature'));
      });
    }

    return this.yaftService.updateFeature(feature.key, { tags: newTags }, feature.secret);
  }

  // Utility method to check if bulk operations are available
  canPerformBulkOperations(features: Feature[]): boolean {
    return features.some(feature => !!feature.secret);
  }

  // Get features that can be bulk operated (have secrets)
  getOperableFeatures(features: Feature[]): Feature[] {
    return features.filter(feature => !!feature.secret);
  }

  // Get features that cannot be bulk operated (no secrets)
  getNonOperableFeatures(features: Feature[]): Feature[] {
    return features.filter(feature => !feature.secret);
  }
}