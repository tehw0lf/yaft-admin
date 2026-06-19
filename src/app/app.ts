import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';
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
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { HttpClientModule } from '@angular/common/http';

import { YaftProviderService } from './services/yaft-provider.service';
import { FilterService } from './services/filter.service';
import { ExportService } from './services/export.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { BulkOperationsService } from './services/bulk-operations.service';
import { FeatureFiltersComponent } from './components/feature-filters/feature-filters.component';
import { ImportPreviewDialogComponent, ImportPreviewDialogData } from './components/import-preview-dialog/import-preview-dialog.component';
import { DragDropDirective } from './directives/drag-drop.directive';
import { timeRangeValidator } from './validators/time-range.validator';
import {
  Feature,
  FeatureWithSecret,
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
    MatDatepickerModule,
    MatNativeDateModule,
    FeatureFiltersComponent,
    DragDropDirective
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private yaftService = inject(YaftProviderService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private filterService = inject(FilterService);
  private exportService = inject(ExportService);
  private errorHandler = inject(ErrorHandlerService);
  private bulkOperationsService = inject(BulkOperationsService);

  @ViewChild('stepper') stepper!: MatStepper;
  private destroy$ = new Subject<void>();

  // Form Controls
  connectionForm: FormGroup;
  featureForm: FormGroup;

  // State
  connectionStatus: ProviderConnection = {
    type: ProviderType.API_SERVICE,
    isConnected: false
  };
  
  features: FeatureWithSecret[] = [];
  filteredFeatures: FeatureWithSecret[] = [];
  displayedColumns: string[] = ['select', 'key', 'status', 'value', 'tags', 'activeAt', 'disabledAt', 'actions'];

  get currentDisplayedColumns(): string[] {
    if (this.isBooleanProvider) {
      return ['select', 'key', 'value', 'actions'];
    }
    return this.displayedColumns;
  }
  
  // UI State
  isConnecting = false;
  isLoading = false;
  isCreating = false;
  isEditing = false;
  editingFeature: FeatureWithSecret | null = null;
  alertMessage = '';
  alertType: 'success' | 'error' = 'success';
  
  // Bulk operations
  selectedFeatures = new Set<FeatureWithSecret>();
  isAllSelected = false;
  isBulkOperating = false;
  
  // Drag and drop state
  isDragOverActive = false;
  
  // Chip input configuration
  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  constructor() {
    this.connectionForm = this.createConnectionForm();
    this.featureForm = this.createFeatureForm();
  }

  ngOnInit() {
    // Subscribe to connection status
    this.yaftService.connection$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connection => {
        this.connectionStatus = connection;
        
        // Update form validation based on provider type
        if (connection.isConnected) {
          this.updateFormValidation();
        }
        
        // WebSocket functionality is not implemented in the Go backend, so we skip WebSocket connection
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
    
    // WebSocket feature updates not implemented in Go backend
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createConnectionForm(): FormGroup {
    return this.fb.group({
      providerType: [ProviderType.API_SERVICE, Validators.required],
      apiUrl: ['http://localhost:8080', Validators.required],
      baseUUID: [''],
      configPath: [''],
      collectionSecret: [''] // Optional secret for existing collections
    });
  }

  private createFeatureForm(): FormGroup {
    return this.fb.group({
      key: ['', Validators.required],
      value: ['false', Validators.required],
      tags: [[]],
      activeAt: [''],
      disabledAt: ['']
    }, { 
      validators: [timeRangeValidator()] 
    });
  }

  private updateFormValidation(): void {
    // Clear existing validators for optional fields
    this.featureForm.get('activeAt')?.clearValidators();
    this.featureForm.get('disabledAt')?.clearValidators();
    this.featureForm.get('activeAtDate')?.clearValidators();
    this.featureForm.get('activeAtTime')?.clearValidators();
    this.featureForm.get('disabledAtDate')?.clearValidators();
    this.featureForm.get('disabledAtTime')?.clearValidators();

    if (this.isBooleanProvider) {
      // For boolean providers, disable advanced fields
      this.featureForm.get('activeAt')?.disable();
      this.featureForm.get('disabledAt')?.disable();
      this.featureForm.get('activeAtDate')?.disable();
      this.featureForm.get('activeAtTime')?.disable();
      this.featureForm.get('disabledAtDate')?.disable();
      this.featureForm.get('disabledAtTime')?.disable();
      // Remove time range validator for boolean providers
      this.featureForm.clearValidators();
    } else {
      // For feature object providers, enable all fields
      this.featureForm.get('activeAt')?.enable();
      this.featureForm.get('disabledAt')?.enable();
      this.featureForm.get('activeAtDate')?.enable();
      this.featureForm.get('activeAtTime')?.enable();
      this.featureForm.get('disabledAtDate')?.enable();
      this.featureForm.get('disabledAtTime')?.enable();
      // Add time range validator for feature object providers
      this.featureForm.setValidators([timeRangeValidator()]);
    }

    // Update validity after changing validators
    this.featureForm.updateValueAndValidity();
  }


  get isApiProvider(): boolean {
    const providerType = this.connectionForm.get('providerType')?.value;
    return providerType === ProviderType.API_SERVICE || providerType === ProviderType.API_SERVICE_BOOLEAN;
  }

  get isLocalStorageProvider(): boolean {
    return this.connectionStatus.type === ProviderType.LOCAL_STORAGE || 
           this.connectionStatus.type === ProviderType.LOCAL_STORAGE_BOOLEAN;
  }

  get isBooleanProvider(): boolean {
    return this.connectionStatus.type === ProviderType.API_SERVICE_BOOLEAN || 
           this.connectionStatus.type === ProviderType.LOCAL_STORAGE_BOOLEAN;
  }

  get isFeatureObjectProvider(): boolean {
    return this.connectionStatus.type === ProviderType.API_SERVICE || 
           this.connectionStatus.type === ProviderType.LOCAL_STORAGE;
  }

  onProviderTypeChange(_event: { value: ProviderType }) {
    if (this.isApiProvider) {
      this.connectionForm.get('apiUrl')?.setValidators([Validators.required]);
      this.connectionForm.get('configPath')?.clearValidators();
    } else {
      // Local storage doesn't require any specific configuration
      this.connectionForm.get('apiUrl')?.clearValidators();
      this.connectionForm.get('configPath')?.clearValidators();
    }
    
    this.connectionForm.get('apiUrl')?.updateValueAndValidity();
    this.connectionForm.get('configPath')?.updateValueAndValidity();
  }

  onConnect() {
    if (this.connectionForm.invalid) return;

    this.isConnecting = true;
    const formValue = this.connectionForm.value;
    
    const isApiProvider = formValue.providerType === ProviderType.API_SERVICE || 
                        formValue.providerType === ProviderType.API_SERVICE_BOOLEAN;
    
    const connection: ProviderConnection = {
      type: formValue.providerType,
      apiUrl: isApiProvider ? formValue.apiUrl : undefined,
      baseUUID: isApiProvider ? formValue.baseUUID : undefined,
      configPath: !isApiProvider ? formValue.configPath : undefined,
      isConnected: false
    };

    // Set collection secret if provided for API providers
    if (isApiProvider && formValue.collectionSecret && formValue.collectionSecret.trim()) {
      this.yaftService.setCollectionSecret(formValue.collectionSecret.trim());
    }

    this.yaftService.connect(connection)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          this.isConnecting = false;
          if (success) {
            this.showAlert('Data source connected, redirecting to feature toggles...', 'success');
            this.onRefresh();
            
            // Auto-advance to feature toggles step after a brief delay
            setTimeout(() => {
              if (this.stepper) {
                this.stepper.next();
              }
            }, 1500);
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

    if (this.isEditing && this.editingFeature) {
      this.onUpdateFeature();
      return;
    }

    this.isCreating = true;
    const formValue = this.featureForm.value;
    
    const feature: Omit<Feature, 'secret'> = {
      key: formValue.key,
      value: formValue.value,
      activeAt: null,
      disabledAt: null,
      tags: formValue.tags || []
    };

    // Only include advanced fields for feature object providers
    if (this.isFeatureObjectProvider) {
      feature.activeAt = formValue.activeAt ? new Date(formValue.activeAt).toISOString() : null;
      feature.disabledAt = formValue.disabledAt ? new Date(formValue.disabledAt).toISOString() : null;
    }

    this.yaftService.createFeature(feature)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newFeature) => {
          this.isCreating = false;
          this.showAlert(`Feature '${newFeature.key}' created successfully`, 'success');
          this.featureForm.reset({ value: 'false', tags: [] });
          
          // WebSocket notifications not implemented in Go backend
          
          // Show secret if created via API
          if (newFeature.secret) {
            this.snackBar.open(`Secret: ${newFeature.secret}`, 'Copy', {
              duration: 10000,
              panelClass: ['secret-snackbar']
            }).onAction().subscribe(() => {
              this.copyToClipboard(newFeature.secret ?? '');
            });
          }
        },
        error: (error) => {
          this.isCreating = false;
          this.showAlert(`Failed to create feature: ${error.message}`, 'error');
        }
      });
  }

  private onUpdateFeature() {
    if (!this.editingFeature || !this.editingFeature.secret) {
      this.showAlert('Cannot update feature without secret', 'error');
      return;
    }

    this.isCreating = true; // Reuse the same loading state
    const formValue = this.featureForm.getRawValue(); // Get raw value to include disabled fields
    
    const updates: Partial<Feature> = {
      value: formValue.value,
      tags: formValue.tags || []
    };

    // Only include advanced fields for feature object providers
    if (this.isFeatureObjectProvider) {
      updates.activeAt = formValue.activeAt ? new Date(formValue.activeAt).toISOString() : null;
      updates.disabledAt = formValue.disabledAt ? new Date(formValue.disabledAt).toISOString() : null;
    }

    this.yaftService.updateFeature(this.editingFeature.key, updates, this.editingFeature.secret)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isCreating = false;
          this.showAlert(`Feature '${this.editingFeature?.key}' updated successfully`, 'success');

          // Exit edit mode and reset form
          this.onCancelEdit();
          this.onRefresh();
          
          // WebSocket notifications not implemented in Go backend
        },
        error: (error) => {
          this.isCreating = false;
          this.showAlert(`Failed to update feature: ${error.message}`, 'error');
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

  onToggleFeature(feature: FeatureWithSecret, enabled: boolean) {
    if (!feature.secret) {
      this.showAlert('Cannot toggle feature without secret', 'error');
      return;
    }

    const updates = { value: enabled ? 'true' : 'false' };
    
    this.yaftService.updateFeature(feature.key, updates, feature.secret)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showAlert(`Feature '${feature.key}' ${enabled ? 'enabled' : 'disabled'}`, 'success');
          this.onRefresh();
          
          // WebSocket notifications not implemented in Go backend
        },
        error: (error) => {
          this.showAlert(`Failed to update feature: ${error.message}`, 'error');
        }
      });
  }

  onEditFeature(feature: FeatureWithSecret) {
    this.isEditing = true;
    this.editingFeature = feature;
    
    // Convert ISO strings to datetime-local format (YYYY-MM-DDTHH:mm)
    this.featureForm.patchValue({
      key: feature.key,
      value: feature.value,
      tags: feature.tags || [],
      activeAt: feature.activeAt ? new Date(feature.activeAt).toISOString().slice(0, 16) : '',
      disabledAt: feature.disabledAt ? new Date(feature.disabledAt).toISOString().slice(0, 16) : ''
    });
    
    // Disable the key field since we can't change it during edit
    this.featureForm.get('key')?.disable();
    
    this.showAlert('Feature loaded for editing. Click "Update Feature" to save changes.', 'success');
  }

  onCancelEdit() {
    this.isEditing = false;
    this.editingFeature = null;
    this.featureForm.reset({ 
      value: 'false', 
      tags: [],
      key: '',
      activeAt: '',
      disabledAt: ''
    });
    this.featureForm.get('key')?.enable();
    this.showAlert('Edit cancelled', 'success');
  }

  onDeleteFeature(feature: FeatureWithSecret) {
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
            
            // WebSocket notifications not implemented in Go backend
          },
          error: (error) => {
            this.showAlert(`Failed to delete feature: ${error.message}`, 'error');
          }
        });
    }
  }

  onCopySecret(feature: FeatureWithSecret) {
    if (feature.secret) {
      this.copyToClipboard(feature.secret);
      this.showAlert('Secret copied to clipboard', 'success');
    }
  }


  // Export/Import methods
  onExportJson(): void {
    const features = this.filteredFeatures.length > 0 ? this.filteredFeatures : this.features;
    const exportData = this.formatFeaturesForExport(features);
    
    if (this.isBooleanProvider && !Array.isArray(exportData)) {
      this.exportService.exportBooleanJson(exportData);
    } else {
      this.exportService.exportToJson(features);
    }
    
    this.errorHandler.showSuccessNotification(`Exported ${features.length} features to JSON`);
  }

  onExportCsv(): void {
    const features = this.filteredFeatures.length > 0 ? this.filteredFeatures : this.features;
    
    if (this.isBooleanProvider) {
      this.exportService.exportBooleanCsv(features);
    } else {
      this.exportService.exportToCsv(features);
    }
    
    this.errorHandler.showSuccessNotification(`Exported ${features.length} features to CSV`);
  }

  private formatFeaturesForExport(features: Feature[]): Record<string, boolean> | Feature[] {
    if (this.isBooleanProvider) {
      // For boolean providers, export as simple key-value object
      const booleanData: Record<string, boolean> = {};
      features.forEach(feature => {
        booleanData[feature.key] = feature.value === 'true';
      });
      return booleanData;
    }
    return features;
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      this.processImportFile(file);
      // Clear the input
      input.value = '';
    }
  }

  onFilesDropped(files: FileList): void {
    if (files.length > 0) {
      // Process the first file
      this.processImportFile(files[0]);
    }
  }

  onDragOver(isDragOver: boolean): void {
    this.isDragOverActive = isDragOver;
  }

  private processImportFile(file: File): void {
    this.errorHandler.showInfoNotification('Importing features...');

    this.exportService.importFromFile(file).then(result => {
      if (result.success) {
        const data: ImportPreviewDialogData = {
          features: result.features,
          warnings: result.warnings,
          existingFeatures: this.features
        };

        const dialogRef = this.dialog.open(ImportPreviewDialogComponent, {
          data,
          autoFocus: false
        });

        dialogRef.afterClosed()
          .pipe(takeUntil(this.destroy$))
          .subscribe(confirmed => {
            if (confirmed) {
              this.importFeatures(result.features);
            }
          });
      } else {
        this.errorHandler.showErrorNotification(
          `Import failed: ${result.errors.join(', ')}`
        );
      }
    });
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

  hasSecret(feature: FeatureWithSecret): boolean {
    return !!feature.secret;
  }

  get timeRangeError(): string | null {
    const errors = this.featureForm.errors;
    if (errors?.['timeRangeInvalid']) {
      return errors['timeRangeInvalid'].message;
    }
    return null;
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


  // Helper method to check if a feature can be selected for bulk operations
  canSelectFeature(feature: FeatureWithSecret): boolean {
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

  // Tag handling methods
  getTags(): string[] {
    return this.featureForm.get('tags')?.value || [];
  }

  addTag(event: MatChipInputEvent): void {
    const value = (event.input?.value || '').trim();
    
    if (value) {
      // Validate tag format: lowercase, alphanumeric, hyphens only
      const tagPattern = /^[a-z0-9-]+$/;
      if (!tagPattern.test(value)) {
        this.showAlert('Tags must be lowercase, alphanumeric, and hyphens only', 'error');
        event.input.value = '';
        return;
      }
      
      // Check for duplicates
      const currentTags = this.getTags();
      if (currentTags.includes(value)) {
        this.showAlert('Tag already exists', 'error');
        event.input.value = '';
        return;
      }
      
      // Check maximum tags limit
      if (currentTags.length >= 10) {
        this.showAlert('Maximum 10 tags allowed per feature', 'error');
        event.input.value = '';
        return;
      }
      
      // Add the tag
      const updatedTags = [...currentTags, value];
      this.featureForm.get('tags')?.setValue(updatedTags);
    }

    // Clear the input
    if (event.input) {
      event.input.value = '';
    }
  }

  removeTag(tagToRemove: string): void {
    const currentTags = this.getTags();
    const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
    this.featureForm.get('tags')?.setValue(updatedTags);
  }

  private showAlert(message: string, type: 'success' | 'error') {
    this.alertMessage = message;
    this.alertType = type;
    
    // Auto-clear after different durations based on type
    const duration = message.includes('redirecting') ? 2000 : 5000;
    setTimeout(() => this.clearAlert(), duration);
  }

  clearAlert() {
    this.alertMessage = '';
  }
}
