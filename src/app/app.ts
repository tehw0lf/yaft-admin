import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

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
import { HttpClientModule } from '@angular/common/http';

import { YaftProviderService } from './services/yaft-provider.service';
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
    MatTooltipModule
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
  displayedColumns: string[] = ['key', 'status', 'value', 'activeAt', 'disabledAt', 'actions'];
  
  // UI State
  isConnecting = false;
  isLoading = false;
  isCreating = false;
  alertMessage = '';
  alertType: 'success' | 'error' = 'success';

  constructor(
    private fb: FormBuilder,
    private yaftService: YaftProviderService,
    private snackBar: MatSnackBar
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
      });

    // Subscribe to features
    this.yaftService.features$
      .pipe(takeUntil(this.destroy$))
      .subscribe(features => {
        this.features = features;
        this.isLoading = false;
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
      disabledAt: ['']
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
      disabledAt: formValue.disabledAt || null
    };

    this.yaftService.createFeature(feature)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newFeature) => {
          this.isCreating = false;
          this.showAlert(`Feature '${newFeature.key}' created successfully`, 'success');
          this.featureForm.reset({ value: 'false' });
          
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
        next: () => {
          this.showAlert(`Feature '${feature.key}' ${enabled ? 'enabled' : 'disabled'}`, 'success');
          this.onRefresh();
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
      disabledAt: feature.disabledAt ? new Date(feature.disabledAt).toISOString().slice(0, 16) : ''
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

  getFeatureStatus(feature: Feature): FeatureStatus {
    return this.yaftService.getFeatureStatus(feature);
  }

  hasSecret(feature: Feature): boolean {
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
