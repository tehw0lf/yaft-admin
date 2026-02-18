import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipInputEvent } from '@angular/material/chips';
import { of, throwError } from 'rxjs';
import { App } from './app';
import { YaftProviderService } from './services/yaft-provider.service';
import { FilterService } from './services/filter.service';
import { ExportService } from './services/export.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { BulkOperationsService } from './services/bulk-operations.service';
import {
  ProviderType,
  ProviderConnection,
  FeatureWithSecret,
} from './models/feature.model';
describe('App', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let mockYaftService: jasmine.SpyObj<YaftProviderService>;
  let _mockFilterService: jasmine.SpyObj<FilterService>;
  let mockExportService: jasmine.SpyObj<ExportService>;
  let mockErrorHandler: jasmine.SpyObj<ErrorHandlerService>;
  let mockBulkOperations: jasmine.SpyObj<BulkOperationsService>;
  const mockConnection: ProviderConnection = {
    type: ProviderType.API_SERVICE,
    isConnected: false,
  };
  const mockFeatures: FeatureWithSecret[] = [
    {
      key: 'test-feature-1',
      value: 'true',
      secret: 'secret1',
      tags: ['test'],
    },
    {
      key: 'test-feature-2',
      value: 'false',
      secret: 'secret2',
    },
  ];
  beforeEach(async () => {
    const yaftSpy = jasmine.createSpyObj(
      'YaftProviderService',
      [
        'connect',
        'loadFeatures',
        'createFeature',
        'updateFeature',
        'deleteFeature',
        'getFeatureStatus',
        'setCollectionSecret',
        'getCurrentConnection',
        'getCurrentFeatures',
      ],
      {
        connection$: of(mockConnection),
        features$: of(mockFeatures),
      }
    );
    const filterSpy = jasmine.createSpyObj('FilterService', [], {
      filteredFeatures$: of(mockFeatures),
    });
    const exportSpy = jasmine.createSpyObj('ExportService', [
      'exportToJson',
      'exportToCsv',
      'exportBooleanJson',
      'exportBooleanCsv',
      'importFromFile',
    ]);
    const errorSpy = jasmine.createSpyObj('ErrorHandlerService', [
      'showSuccessNotification',
      'showErrorNotification',
      'showInfoNotification',
      'showWarningNotification',
    ]);
    const bulkSpy = jasmine.createSpyObj('BulkOperationsService', [
      'getOperableFeatures',
      'enableFeatures',
      'disableFeatures',
      'deleteFeatures',
      'exportFeatures',
    ]);
    await TestBed.configureTestingModule({
      imports: [
        App,
        ReactiveFormsModule,
        NoopAnimationsModule,
        HttpClientTestingModule,
        MatSnackBarModule,
        MatStepperModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatButtonModule,
        MatCardModule,
        MatTableModule,
        MatChipsModule,
        MatIconModule,
        MatTooltipModule,
      ],
      providers: [
        { provide: YaftProviderService, useValue: yaftSpy },
        { provide: FilterService, useValue: filterSpy },
        { provide: ExportService, useValue: exportSpy },
        { provide: ErrorHandlerService, useValue: errorSpy },
        { provide: BulkOperationsService, useValue: bulkSpy },
      ],
    }).compileComponents();
    mockYaftService = TestBed.inject(
      YaftProviderService
    ) as jasmine.SpyObj<YaftProviderService>;
    _mockFilterService = TestBed.inject(
      FilterService
    ) as jasmine.SpyObj<FilterService>;
    mockExportService = TestBed.inject(
      ExportService
    ) as jasmine.SpyObj<ExportService>;
    mockErrorHandler = TestBed.inject(
      ErrorHandlerService
    ) as jasmine.SpyObj<ErrorHandlerService>;
    mockBulkOperations = TestBed.inject(
      BulkOperationsService
    ) as jasmine.SpyObj<BulkOperationsService>;
  });
  beforeEach(() => {
    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });
    it('should initialize with default state', () => {
      expect(component.connectionStatus.isConnected).toBe(false);
      expect(component.features).toEqual(mockFeatures);
      expect(component.isConnecting).toBe(false);
      expect(component.isLoading).toBe(false);
    });
    it('should create connection and feature forms', () => {
      expect(component.connectionForm).toBeDefined();
      expect(component.featureForm).toBeDefined();
      expect(component.connectionForm.get('providerType')?.value).toBe(
        ProviderType.API_SERVICE
      );
    });
  });
  describe('Provider Type Management', () => {
    it('should identify API provider types correctly', () => {
      component.connectionForm.patchValue({
        providerType: ProviderType.API_SERVICE,
      });
      expect(component.isApiProvider).toBe(true);
      component.connectionForm.patchValue({
        providerType: ProviderType.LOCAL_STORAGE,
      });
      expect(component.isApiProvider).toBe(false);
    });
    it('should identify boolean provider types correctly', () => {
      component.connectionStatus = {
        type: ProviderType.API_SERVICE_BOOLEAN,
        isConnected: true,
      };
      expect(component.isBooleanProvider).toBe(true);
      component.connectionStatus = {
        type: ProviderType.API_SERVICE,
        isConnected: true,
      };
      expect(component.isBooleanProvider).toBe(false);
    });
    it('should adjust displayed columns based on provider type', () => {
      component.connectionStatus = {
        type: ProviderType.API_SERVICE_BOOLEAN,
        isConnected: true,
      };
      expect(component.currentDisplayedColumns).toEqual([
        'select',
        'key',
        'value',
        'actions',
      ]);
      component.connectionStatus = {
        type: ProviderType.API_SERVICE,
        isConnected: true,
      };
      expect(component.currentDisplayedColumns).toEqual(
        component.displayedColumns
      );
    });
  });
  describe('Connection Management', () => {
    it('should handle successful connection', () => {
      mockYaftService.connect.and.returnValue(of(true));
      component.connectionForm.patchValue({
        providerType: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
      });
      component.onConnect();
      expect(mockYaftService.connect).toHaveBeenCalled();
      expect(component.isConnecting).toBe(false);
    });
    it('should handle connection failure', () => {
      const errorMsg = 'Connection failed';
      mockYaftService.connect.and.returnValue(
        throwError(() => new Error(errorMsg))
      );
      component.connectionForm.patchValue({
        providerType: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
      });
      component.onConnect();
      expect(component.isConnecting).toBe(false);
      expect(component.alertType).toBe('error');
    });
    it('should set collection secret when provided', () => {
      mockYaftService.connect.and.returnValue(of(true));
      component.connectionForm.patchValue({
        providerType: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        collectionSecret: 'test-secret',
      });
      component.onConnect();
      expect(mockYaftService.setCollectionSecret).toHaveBeenCalledWith(
        'test-secret'
      );
    });
    it('should not connect with invalid form', () => {
      component.connectionForm.patchValue({
        providerType: ProviderType.API_SERVICE,
        apiUrl: '', // Invalid - required field
      });
      component.onConnect();
      expect(mockYaftService.connect).not.toHaveBeenCalled();
    });
  });
  describe('Feature Management', () => {
    beforeEach(() => {
      component.connectionStatus = {
        type: ProviderType.API_SERVICE,
        isConnected: true,
      };
    });
    it('should create new feature', () => {
      const newFeature: FeatureWithSecret = {
        key: 'new-feature',
        value: 'true',
        secret: 'new-secret',
      };
      mockYaftService.createFeature.and.returnValue(of(newFeature));
      component.featureForm.patchValue({
        key: 'new-feature',
        value: 'true',
      });
      component.onCreateFeature();
      expect(mockYaftService.createFeature).toHaveBeenCalled();
      expect(component.isCreating).toBe(false);
    });
    it('should handle feature creation failure', () => {
      mockYaftService.createFeature.and.returnValue(
        throwError(() => new Error('Creation failed'))
      );
      component.featureForm.patchValue({
        key: 'new-feature',
        value: 'true',
      });
      component.onCreateFeature();
      expect(component.isCreating).toBe(false);
      expect(component.alertType).toBe('error');
    });
    it('should toggle feature state', () => {
      const feature: FeatureWithSecret = { ...mockFeatures[0] };
      const updatedFeature: FeatureWithSecret = { ...feature, value: 'false' };
      mockYaftService.updateFeature.and.returnValue(of(updatedFeature));
      component.onToggleFeature(feature, false);
      expect(mockYaftService.updateFeature).toHaveBeenCalledWith(
        feature.key,
        { value: 'false' },
        feature.secret
      );
    });
    it('should not toggle feature without secret', () => {
      const featureWithoutSecret: FeatureWithSecret = {
        key: 'no-secret-feature',
        value: 'true',
      };
      component.onToggleFeature(featureWithoutSecret, false);
      expect(mockYaftService.updateFeature).not.toHaveBeenCalled();
      expect(component.alertMessage).toContain(
        'Cannot toggle feature without secret'
      );
    });
    it('should edit feature', () => {
      const feature = mockFeatures[0];
      component.onEditFeature(feature);
      expect(component.isEditing).toBe(true);
      expect(component.editingFeature).toBe(feature);
      expect(component.featureForm.get('key')?.value).toBe(feature.key);
      expect(component.featureForm.get('key')?.disabled).toBe(true);
    });
    it('should cancel edit mode', () => {
      component.isEditing = true;
      component.editingFeature = mockFeatures[0];
      component.featureForm.get('key')?.disable();
      component.onCancelEdit();
      expect(component.isEditing).toBe(false);
      expect(component.editingFeature).toBeNull();
      expect(component.featureForm.get('key')?.enabled).toBe(true);
    });
    it('should delete feature with confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      mockYaftService.deleteFeature.and.returnValue(of(void 0));
      const feature = mockFeatures[0];
      component.onDeleteFeature(feature);
      expect(window.confirm).toHaveBeenCalled();
      expect(mockYaftService.deleteFeature).toHaveBeenCalledWith(
        feature.key,
        feature.secret
      );
    });
    it('should not delete feature without confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      const feature = mockFeatures[0];
      component.onDeleteFeature(feature);
      expect(mockYaftService.deleteFeature).not.toHaveBeenCalled();
    });
  });
  describe('Tag Management', () => {
    it('should add valid tag', () => {
      const mockEvent = {
        input: { value: 'valid-tag' },
        value: 'valid-tag',
        chipInput: {} as MatChipInputEvent['chipInput']
      } as MatChipInputEvent;
      component.featureForm.get('tags')?.setValue(['existing-tag']);
      component.addTag(mockEvent);
      const tags = component.getTags();
      expect(tags).toContain('valid-tag');
      expect(mockEvent.input.value).toBe('');
    });
    it('should reject invalid tag format', () => {
      const mockEvent = {
        input: { value: 'Invalid Tag!' },
        value: 'Invalid Tag!',
        chipInput: {} as MatChipInputEvent['chipInput']
      } as MatChipInputEvent;
      component.addTag(mockEvent);
      expect(component.alertMessage).toContain(
        'Tags must be lowercase, alphanumeric, and hyphens only'
      );
      expect(mockEvent.input.value).toBe('');
    });
    it('should reject duplicate tags', () => {
      const mockEvent = {
        input: { value: 'existing-tag' },
        value: 'existing-tag',
        chipInput: {} as MatChipInputEvent['chipInput']
      } as MatChipInputEvent;
      component.featureForm.get('tags')?.setValue(['existing-tag']);
      component.addTag(mockEvent);
      expect(component.alertMessage).toContain('Tag already exists');
    });
    it('should remove tag', () => {
      component.featureForm.get('tags')?.setValue(['tag1', 'tag2', 'tag3']);
      component.removeTag('tag2');
      const tags = component.getTags();
      expect(tags).toEqual(['tag1', 'tag3']);
    });
  });
  describe('Bulk Operations', () => {
    beforeEach(() => {
      mockBulkOperations.getOperableFeatures.and.returnValue(mockFeatures);
    });
    it('should select all features', () => {
      component.toggleAllSelection();
      expect(component.selectedFeatures.size).toBe(mockFeatures.length);
      expect(component.isAllSelected).toBe(true);
    });
    it('should clear all selections', () => {
      mockFeatures.forEach((f) => component.selectedFeatures.add(f));
      component.isAllSelected = true;
      component.toggleAllSelection();
      expect(component.selectedFeatures.size).toBe(0);
      expect(component.isAllSelected).toBe(false);
    });
    it('should toggle individual feature selection', () => {
      const feature = mockFeatures[0];
      component.toggleFeatureSelection(feature);
      expect(component.selectedFeatures.has(feature)).toBe(true);
      component.toggleFeatureSelection(feature);
      expect(component.selectedFeatures.has(feature)).toBe(false);
    });
    it('should perform bulk enable operation', () => {
      const mockResult = { success: 2, failed: 0, errors: [] };
      mockBulkOperations.enableFeatures.and.returnValue(of(mockResult));
      mockFeatures.forEach((f) => component.selectedFeatures.add(f));
      component.onBulkEnable();
      expect(mockBulkOperations.enableFeatures).toHaveBeenCalled();
      expect(component.selectedFeatures.size).toBe(0);
    });
  });
  describe('Export/Import Operations', () => {
    it('should export features to JSON', () => {
      component.onExportJson();
      expect(mockExportService.exportToJson).toHaveBeenCalledWith(mockFeatures);
      expect(mockErrorHandler.showSuccessNotification).toHaveBeenCalled();
    });
    it('should export features to CSV', () => {
      component.onExportCsv();
      expect(mockExportService.exportToCsv).toHaveBeenCalledWith(mockFeatures);
      expect(mockErrorHandler.showSuccessNotification).toHaveBeenCalled();
    });
    it('should handle file import', () => {
      const mockFile = new File(['{}'], 'test.json', {
        type: 'application/json',
      });
      const mockResult = {
        success: true,
        features: [],
        warnings: [],
        errors: [],
      };
      mockExportService.importFromFile.and.returnValue(
        Promise.resolve(mockResult)
      );
      spyOn(window, 'confirm').and.returnValue(true);
      component.onFilesDropped({ 0: mockFile, length: 1 } as FileList);
      expect(mockExportService.importFromFile).toHaveBeenCalledWith(mockFile);
    });
  });
  describe('Utility Methods', () => {
    it('should copy text to clipboard', () => {
      spyOn(navigator.clipboard, 'writeText').and.returnValue(
        Promise.resolve()
      );
      const feature = mockFeatures[0];
      component.onCopySecret(feature);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        feature.secret
      );
    });
    it('should check if feature has secret', () => {
      expect(component.hasSecret(mockFeatures[0])).toBe(true);
      expect(component.hasSecret({ key: 'no-secret', value: 'true' })).toBe(
        false
      );
    });
    it('should get feature status from service', () => {
      const mockStatus = {
        key: 'test',
        isEnabled: true,
        status: 'active' as const,
      };
      mockYaftService.getFeatureStatus.and.returnValue(mockStatus);
      const status = component.getFeatureStatus(mockFeatures[0]);
      expect(mockYaftService.getFeatureStatus).toHaveBeenCalledWith(
        mockFeatures[0]
      );
      expect(status).toBe(mockStatus);
    });
  });
});
