import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { YaftProviderService } from './yaft-provider.service';
import { ErrorHandlerService } from './error-handler.service';
import { Feature, FeatureWithSecret } from '../models/feature.model';

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: string[];
  results: FeatureWithSecret[];
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
  private yaftService = inject(YaftProviderService);
  private errorHandler = inject(ErrorHandlerService);


  // Enable multiple features
  enableFeatures(features: FeatureWithSecret[], progressCallback?: (progress: BulkOperationProgress) => void): Observable<BulkOperationResult> {
    return this.executeBulkOperation(
      features,
      (feature) => this.enableSingleFeature(feature),
      'Enabling',
      progressCallback
    );
  }

  // Disable multiple features
  disableFeatures(features: FeatureWithSecret[], progressCallback?: (progress: BulkOperationProgress) => void): Observable<BulkOperationResult> {
    return this.executeBulkOperation(
      features,
      (feature) => this.disableSingleFeature(feature),
      'Disabling',
      progressCallback
    );
  }

  // Delete multiple features
  deleteFeatures(features: FeatureWithSecret[], progressCallback?: (progress: BulkOperationProgress) => void): Observable<BulkOperationResult> {
    return this.executeBulkOperation(
      features,
      (feature) => this.deleteSingleFeature(feature),
      'Deleting',
      progressCallback
    );
  }


  // Export selected features
  exportFeatures(features: FeatureWithSecret[]): void {
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

  private executeBulkOperation(
    features: FeatureWithSecret[],
    operation: (feature: Feature) => Observable<FeatureWithSecret | void>,
    actionName: string,
    progressCallback?: (progress: BulkOperationProgress) => void
  ): Observable<BulkOperationResult> {
    const total = features.length;
    let completed = 0;
    const results: FeatureWithSecret[] = [];
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
            if (result) results.push(result);
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

  private enableSingleFeature(feature: FeatureWithSecret): Observable<FeatureWithSecret> {
    if (!feature.secret) {
      return new Observable(observer => {
        observer.error(new Error('No secret available for feature'));
      });
    }

    return this.yaftService.updateFeature(feature.key, { value: 'true' }, feature.secret);
  }

  private disableSingleFeature(feature: FeatureWithSecret): Observable<FeatureWithSecret> {
    if (!feature.secret) {
      return new Observable(observer => {
        observer.error(new Error('No secret available for feature'));
      });
    }

    return this.yaftService.updateFeature(feature.key, { value: 'false' }, feature.secret);
  }

  private deleteSingleFeature(feature: FeatureWithSecret): Observable<void> {
    if (!feature.secret) {
      return new Observable(observer => {
        observer.error(new Error('No secret available for feature'));
      });
    }

    return this.yaftService.deleteFeature(feature.key, feature.secret);
  }


  // Utility method to check if bulk operations are available
  canPerformBulkOperations(features: FeatureWithSecret[]): boolean {
    return features.some(feature => !!feature.secret);
  }

  // Get features that can be bulk operated (have secrets)
  getOperableFeatures(features: FeatureWithSecret[]): FeatureWithSecret[] {
    return features.filter(feature => !!feature.secret);
  }

  // Get features that cannot be bulk operated (no secrets)
  getNonOperableFeatures(features: FeatureWithSecret[]): FeatureWithSecret[] {
    return features.filter(feature => !feature.secret);
  }
}