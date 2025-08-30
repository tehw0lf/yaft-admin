import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { COMMA, ENTER } from '@angular/cdk/keycodes';

// Angular Material Imports
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipInputEvent } from '@angular/material/chips';
import { HttpClientModule } from '@angular/common/http';

import { YaftProviderService } from './services/yaft-provider.service';
import { FilterService } from './services/filter.service';
import { ExportService } from './services/export.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { BulkOperationsService } from './services/bulk-operations.service';
import { WebSocketService } from './services/websocket.service';
import { FeatureFiltersComponent } from './components/feature-filters/feature-filters.component';
import { timeRangeValidator } from './validators/time-range.validator';
import {
  Feature,
  ProviderType,
  ProviderConnection,
  FeatureStatus
} from './models/feature.model';

@Component({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,
    // Material modules
    MatStepperModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatSlideToggleModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule,
    MatCheckboxModule,
    FeatureFiltersComponent
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Form Controls
  connectionForm: FormGroup;
  featureForm: FormGroup;

  // State
  connectionStatus: ProviderConnection = {
    type: ProviderType.API_SERVICE,
    isConnected: false
  };
  
  features: Feature[] = [];
  filteredFeatures: Feature[] = [];
  displayedColumns: string[] = ['select', 'key', 'status', 'value', 'activeAt', 'disabledAt', 'tags', 'actions'];
  
  // UI State
  isConnecting = false;
  isLoading = false;
  isCreating = false;
  alertMessage = '';
  alertType: 'success' | 'error' = 'success';
  
  // Bulk operations
  selectedFeatures = new Set<Feature>();
  isAllSelected = false;
  isBulkOperating = false;
  
  // Chip input configuration
  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  constructor(
    private fb: FormBuilder,
    private yaftService: YaftProviderService,
    private snackBar: MatSnackBar,
    private filterService: FilterService,
    private exportService: ExportService,
    private errorHandler: ErrorHandlerService,
    private bulkOperationsService: BulkOperationsService,
    private websocketService: WebSocketService
  ) {
    this.connectionForm = this.createConnectionForm();
    this.featureForm = this.createFeatureForm();
  }

  ngOnInit() {
    // Subscribe to connection status
    this.yaftService.connection$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connection => {
        this.connectionStatus = connection;
        
        // Connect WebSocket when YAFT connection is established
        if (connection.isConnected && connection.apiUrl) {
          const wsUrl = connection.apiUrl.replace(/^http/, 'ws') + '/ws';
          this.websocketService.connect(wsUrl);
        }
      });

    // Subscribe to features
    this.yaftService.features$
      .pipe(takeUntil(this.destroy$))
      .subscribe(features => {
        this.features = features;
        this.isLoading = false;
      });
    
    // Subscribe to filtered features
    this.filterService.filteredFeatures$
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredFeatures => {
        this.filteredFeatures = filteredFeatures;
      });
    
    // Subscribe to WebSocket feature updates
    this.websocketService.featureUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        // Refresh features when remote updates occur
        if (this.connectionStatus.isConnected) {
          this.yaftService.loadFeatures();
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createConnectionForm(): FormGroup {
    return this.fb.group({
      providerType: [ProviderType.API_SERVICE, Validators.required],
      apiUrl: ['http://localhost:8080'],
      baseUUID: [''],
      configPath: ['./config.json']
    });
  }

  private createFeatureForm(): FormGroup {
    return this.fb.group({
      key: ['', Validators.required],
      value: ['false', Validators.required],
      activeAt: [''],
      disabledAt: [''],
      tags: [[]]
    }, { 
      validators: [timeRangeValidator()] 
    });
  }

  get isApiProvider(): boolean {
    const providerType = this.connectionForm.get('providerType')?.value;
    return providerType === ProviderType.API_SERVICE || providerType === ProviderType.API_SERVICE_BOOLEAN;
  }

  onProviderTypeChange(event: any) {
    const providerType = event.value as ProviderType;
    
    if (this.isApiProvider) {
      this.connectionForm.get('apiUrl')?.setValidators([Validators.required]);
      this.connectionForm.get('configPath')?.clearValidators();
    } else {
      this.connectionForm.get('configPath')?.setValidators([Validators.required]);
      this.connectionForm.get('apiUrl')?.clearValidators();
    }
    
    this.connectionForm.get('apiUrl')?.updateValueAndValidity();
    this.connectionForm.get('configPath')?.updateValueAndValidity();
  }

  onConnect() {
    if (this.connectionForm.invalid) return;

    this.isConnecting = true;
    const formValue = this.connectionForm.value;
    
    const connection: ProviderConnection = {
      type: formValue.providerType,
      apiUrl: formValue.apiUrl,
      baseUUID: formValue.baseUUID,
      configPath: formValue.configPath,
      isConnected: false
    };

    this.yaftService.connect(connection)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          this.isConnecting = false;
          if (success) {
            this.showAlert('Successfully connected to data source', 'success');
            this.onRefresh();
          }
        },
        error: (error) => {
          this.isConnecting = false;
          this.showAlert(`Failed to connect: ${error.message}`, 'error');
        }
      });
  }

  onCreateFeature() {
    if (this.featureForm.invalid) return;

    this.isCreating = true;
    const formValue = this.featureForm.value;
    
    const feature = {
      key: formValue.key,
      value: formValue.value,
      activeAt: formValue.activeAt || null,
      disabledAt: formValue.disabledAt || null,
      tags: formValue.tags || []
    };

    this.yaftService.createFeature(feature)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newFeature) => {
          this.isCreating = false;
          this.showAlert(`Feature '${newFeature.key}' created successfully`, 'success');
          this.featureForm.reset({ value: 'false', tags: [] });
          
          // Send WebSocket notification
          if (this.websocketService.isConnected()) {
            this.websocketService.notifyFeatureUpdate(newFeature, 'create');
          }
          
          // Show secret if created via API
          if (newFeature.secret) {
            this.snackBar.open(`Secret: ${newFeature.secret}`, 'Copy', {
              duration: 10000,
              panelClass: ['secret-snackbar']
            }).onAction().subscribe(() => {
              this.copyToClipboard(newFeature.secret!);
            });
          }
        },
        error: (error) => {
          this.isCreating = false;
          this.showAlert(`Failed to create feature: ${error.message}`, 'error');
        }
      });
  }

  onRefresh() {
    if (!this.connectionStatus.isConnected) return;
    
    this.isLoading = true;
    this.yaftService.loadFeatures()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Features are updated via the service subscription
        },
        error: (error) => {
          this.isLoading = false;
          this.showAlert(`Failed to load features: ${error.message}`, 'error');
        }
      });
  }

  onToggleFeature(feature: Feature, enabled: boolean) {
    if (!feature.secret) {
      this.showAlert('Cannot toggle feature without secret', 'error');
      return;
    }

    const updates = { value: enabled ? 'true' : 'false' };
    
    this.yaftService.updateFeature(feature.key, updates, feature.secret)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedFeature) => {
          this.showAlert(`Feature '${feature.key}' ${enabled ? 'enabled' : 'disabled'}`, 'success');
          this.onRefresh();
          
          // Send WebSocket notification
          if (this.websocketService.isConnected()) {
            this.websocketService.notifyFeatureUpdate(updatedFeature || feature, 'update');
          }
        },
        error: (error) => {
          this.showAlert(`Failed to update feature: ${error.message}`, 'error');
        }
      });
  }

  onEditFeature(feature: Feature) {
    // For now, just populate the form with the feature data
    // In a full implementation, this could open a dialog
    this.featureForm.patchValue({
      key: feature.key,
      value: feature.value,
      activeAt: feature.activeAt ? new Date(feature.activeAt).toISOString().slice(0, 16) : '',
      disabledAt: feature.disabledAt ? new Date(feature.disabledAt).toISOString().slice(0, 16) : '',
      tags: feature.tags || []
    });
    
    this.showAlert('Feature loaded in form for editing. Note: Key cannot be changed.', 'success');
  }

  onDeleteFeature(feature: Feature) {
    if (!feature.secret) {
      this.showAlert('Cannot delete feature without secret', 'error');
      return;
    }

    if (confirm(`Are you sure you want to delete the feature '${feature.key}'?`)) {
      this.yaftService.deleteFeature(feature.key, feature.secret)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.showAlert(`Feature '${feature.key}' deleted successfully`, 'success');
            
            // Send WebSocket notification
            if (this.websocketService.isConnected()) {
              this.websocketService.notifyFeatureUpdate(feature, 'delete');
            }
          },
          error: (error) => {
            this.showAlert(`Failed to delete feature: ${error.message}`, 'error');
          }
        });
    }
  }

  onCopySecret(feature: Feature) {
    if (feature.secret) {
      this.copyToClipboard(feature.secret);
      this.showAlert('Secret copied to clipboard', 'success');
    }
  }

  // Tag management methods
  addTag(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    
    if (value) {
      const currentTags = this.featureForm.get('tags')?.value || [];
      if (!currentTags.includes(value)) {
        currentTags.push(value);
        this.featureForm.patchValue({ tags: currentTags });
      }
    }
    
    event.chipInput!.clear();
  }

  removeTag(tag: string): void {
    const currentTags = this.featureForm.get('tags')?.value || [];
    const index = currentTags.indexOf(tag);

    if (index >= 0) {
      currentTags.splice(index, 1);
      this.featureForm.patchValue({ tags: currentTags });
    }
  }

  // Export/Import methods
  onExportJson(): void {
    const features = this.filteredFeatures.length > 0 ? this.filteredFeatures : this.features;
    this.exportService.exportToJson(features);
    this.errorHandler.showSuccessNotification(`Exported ${features.length} features to JSON`);
  }

  onExportCsv(): void {
    const features = this.filteredFeatures.length > 0 ? this.filteredFeatures : this.features;
    this.exportService.exportToCsv(features);
    this.errorHandler.showSuccessNotification(`Exported ${features.length} features to CSV`);
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      this.errorHandler.showInfoNotification('Importing features...');
      
      this.exportService.importFromFile(file).then(result => {
        if (result.success) {
          this.errorHandler.showSuccessNotification(
            `Successfully imported ${result.features.length} features`
          );
          
          if (result.warnings.length > 0) {
            console.warn('Import warnings:', result.warnings);
            result.warnings.forEach(warning => 
              this.errorHandler.showWarningNotification(warning, 2000)
            );
          }
          
          // TODO: Show import preview dialog and allow user to confirm
          this.showImportPreview(result.features);
        } else {
          this.errorHandler.showErrorNotification(
            `Import failed: ${result.errors.join(', ')}`
          );
        }
        
        // Clear the input
        input.value = '';
      });
    }
  }

  private showImportPreview(features: Feature[]): void {
    // For now, just show a simple confirmation
    // In a full implementation, this would show a dialog with feature preview
    const confirmed = confirm(
      `Import ${features.length} features? This will add them to your current provider.`
    );
    
    if (confirmed) {
      this.importFeatures(features);
    }
  }

  private importFeatures(features: Feature[]): void {
    let importedCount = 0;
    const errors: string[] = [];

    // Import features one by one to handle errors gracefully
    const importNext = (index: number) => {
      if (index >= features.length) {
        // All done
        if (importedCount > 0) {
          this.errorHandler.showSuccessNotification(
            `Successfully imported ${importedCount} features`
          );
          this.onRefresh();
        }
        if (errors.length > 0) {
          this.errorHandler.showErrorNotification(
            `Failed to import ${errors.length} features`
          );
        }
        return;
      }

      const feature = features[index];
      this.yaftService.createFeature(feature)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            importedCount++;
            importNext(index + 1);
          },
          error: (error) => {
            errors.push(`${feature.key}: ${error.message}`);
            importNext(index + 1);
          }
        });
    };

    importNext(0);
  }

  getFeatureStatus(feature: Feature): FeatureStatus {
    return this.yaftService.getFeatureStatus(feature);
  }

  hasSecret(feature: Feature): boolean {
    return !!feature.secret;
  }

  get timeRangeError(): string | null {
    const errors = this.featureForm.errors;
    if (errors?.['timeRangeInvalid']) {
      return errors['timeRangeInvalid'].message;
    }
    return null;
  }

  getTags(feature: Feature): string[] {
    return feature.tags || [];
  }

  // Bulk Operations Methods
  toggleAllSelection(): void {
    if (this.isAllSelected) {
      this.selectedFeatures.clear();
    } else {
      const operableFeatures = this.bulkOperationsService.getOperableFeatures(this.filteredFeatures);
      operableFeatures.forEach(feature => this.selectedFeatures.add(feature));
    }
    this.updateSelectionState();
  }

  toggleFeatureSelection(feature: Feature): void {
    if (this.selectedFeatures.has(feature)) {
      this.selectedFeatures.delete(feature);
    } else {
      this.selectedFeatures.add(feature);
    }
    this.updateSelectionState();
  }

  isFeatureSelected(feature: Feature): boolean {
    return this.selectedFeatures.has(feature);
  }

  updateSelectionState(): void {
    const operableFeatures = this.bulkOperationsService.getOperableFeatures(this.filteredFeatures);
    this.isAllSelected = operableFeatures.length > 0 && 
                        operableFeatures.every(feature => this.selectedFeatures.has(feature));
  }

  getSelectedCount(): number {
    return this.selectedFeatures.size;
  }

  canPerformBulkActions(): boolean {
    return this.selectedFeatures.size > 0 && !this.isBulkOperating;
  }

  // Bulk Action Methods
  onBulkEnable(): void {
    this.performBulkOperation('enable', 'Enabling features...');
  }

  onBulkDisable(): void {
    this.performBulkOperation('disable', 'Disabling features...');
  }

  onBulkDelete(): void {
    const confirmed = confirm(
      `Are you sure you want to delete ${this.selectedFeatures.size} selected features? This action cannot be undone.`
    );
    
    if (confirmed) {
      this.performBulkOperation('delete', 'Deleting features...');
    }
  }

  onBulkExport(): void {
    const selectedArray = Array.from(this.selectedFeatures);
    this.bulkOperationsService.exportFeatures(selectedArray);
  }

  onBulkAddTags(): void {
    const tagsInput = prompt('Enter tags to add (comma-separated):');
    if (tagsInput) {
      const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (tags.length > 0) {
        this.performBulkTagOperation('add', tags);
      }
    }
  }

  onBulkRemoveTags(): void {
    // Get all unique tags from selected features
    const allTags = new Set<string>();
    this.selectedFeatures.forEach(feature => {
      if (feature.tags) {
        feature.tags.forEach(tag => allTags.add(tag));
      }
    });

    if (allTags.size === 0) {
      this.errorHandler.showWarningNotification('Selected features have no tags to remove');
      return;
    }

    const tagsArray = Array.from(allTags).sort();
    const message = `Available tags: ${tagsArray.join(', ')}\n\nEnter tags to remove (comma-separated):`;
    const tagsInput = prompt(message);
    
    if (tagsInput) {
      const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (tags.length > 0) {
        this.performBulkTagOperation('remove', tags);
      }
    }
  }

  private performBulkOperation(operation: 'enable' | 'disable' | 'delete', loadingMessage: string): void {
    this.isBulkOperating = true;
    this.errorHandler.showInfoNotification(loadingMessage);

    const selectedArray = Array.from(this.selectedFeatures);
    let operationObservable;

    switch (operation) {
      case 'enable':
        operationObservable = this.bulkOperationsService.enableFeatures(selectedArray);
        break;
      case 'disable':
        operationObservable = this.bulkOperationsService.disableFeatures(selectedArray);
        break;
      case 'delete':
        operationObservable = this.bulkOperationsService.deleteFeatures(selectedArray);
        break;
    }

    operationObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isBulkOperating = false;
          
          if (result.success > 0) {
            this.errorHandler.showSuccessNotification(
              `Successfully ${operation}d ${result.success} features`
            );
          }
          
          if (result.failed > 0) {
            this.errorHandler.showWarningNotification(
              `Failed to ${operation} ${result.failed} features`
            );
            console.warn('Bulk operation errors:', result.errors);
          }

          // Clear selection and refresh
          this.selectedFeatures.clear();
          this.updateSelectionState();
          this.onRefresh();
        },
        error: (error) => {
          this.isBulkOperating = false;
          this.errorHandler.showErrorNotification(`Bulk ${operation} operation failed: ${error.message}`);
        }
      });
  }

  private performBulkTagOperation(operation: 'add' | 'remove', tags: string[]): void {
    this.isBulkOperating = true;
    const actionName = operation === 'add' ? 'Adding' : 'Removing';
    this.errorHandler.showInfoNotification(`${actionName} tags...`);

    const selectedArray = Array.from(this.selectedFeatures);
    const operationObservable = operation === 'add' 
      ? this.bulkOperationsService.addTagsToFeatures(selectedArray, tags)
      : this.bulkOperationsService.removeTagsFromFeatures(selectedArray, tags);

    operationObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isBulkOperating = false;
          
          if (result.success > 0) {
            const verb = operation === 'add' ? 'added to' : 'removed from';
            this.errorHandler.showSuccessNotification(
              `Successfully ${verb} ${result.success} features`
            );
          }
          
          if (result.failed > 0) {
            const verb = operation === 'add' ? 'add to' : 'remove from';
            this.errorHandler.showWarningNotification(
              `Failed to ${verb} ${result.failed} features`
            );
          }

          // Clear selection and refresh
          this.selectedFeatures.clear();
          this.updateSelectionState();
          this.onRefresh();
        },
        error: (error) => {
          this.isBulkOperating = false;
          this.errorHandler.showErrorNotification(`Bulk tag operation failed: ${error.message}`);
        }
      });
  }

  // Helper method to check if a feature can be selected for bulk operations
  canSelectFeature(feature: Feature): boolean {
    return !!feature.secret;
  }

  private copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  }

  private showAlert(message: string, type: 'success' | 'error') {
    this.alertMessage = message;
    this.alertType = type;
    
    // Auto-clear after 5 seconds
    setTimeout(() => this.clearAlert(), 5000);
  }

  clearAlert() {
    this.alertMessage = '';
  }
}
