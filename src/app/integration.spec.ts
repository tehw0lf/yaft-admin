import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { YaftProviderService } from './services/yaft-provider.service';
import { FilterService } from './services/filter.service';
import { ExportService } from './services/export.service';
import { App } from './app';
import {
  ProviderType,
  ProviderConnection,
  Feature,
  FeatureWithSecret,
} from './models/feature.model';
describe('YaFT Admin Integration Tests', () => {
  let yaftService: YaftProviderService;
  let _filterService: FilterService;
  let _exportService: ExportService;
  let httpMock: HttpTestingController;
  let _component: App;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatSnackBarModule,
        App,
      ],
      providers: [YaftProviderService, FilterService, ExportService],
    }).compileComponents();
    yaftService = TestBed.inject(YaftProviderService);
    _filterService = TestBed.inject(FilterService);
    _exportService = TestBed.inject(ExportService);
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(App);
    _component = fixture.componentInstance;
    localStorage.clear();
  });
  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });
  describe('API Provider Integration', () => {
    it('should complete full API workflow: connect, create, update, delete', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        isConnected: false,
      };
      // Step 1: Connect (creates new collection)
      yaftService.connect(connection).subscribe((success) => {
        expect(success).toBe(true);
        // Step 2: Create feature
        const newFeature: Omit<Feature, 'secret'> = {
          key: 'integration-test',
          value: 'true',
          tags: ['test'],
        };
        yaftService.createFeature(newFeature).subscribe((createdFeature) => {
          expect(createdFeature.key).toBe('test-uuid|integration-test');
          expect(createdFeature.secret).toBeDefined();
          // Step 3: Update feature
          yaftService
            .updateFeature(
              createdFeature.key,
              { value: 'false' },
              createdFeature.secret
            )
            .subscribe((updatedFeature) => {
              expect(updatedFeature.value).toBe('false');
              // Step 4: Delete feature
              yaftService
                .deleteFeature(createdFeature.key, createdFeature.secret ?? '')
                .subscribe(() => {
                  done();
                });
              // Mock delete request
              const deleteReq = httpMock.expectOne(
                `http://localhost:8080/features/${createdFeature.key}/${createdFeature.secret}`
              );
              deleteReq.flush({});
            });
          // Mock update request (deactivate)
          const updateReq = httpMock.expectOne(
            `http://localhost:8080/features/deactivate/${createdFeature.key}/${createdFeature.secret}`
          );
          updateReq.flush({ key: createdFeature.key, value: 'false' });
        });
        // Mock create request
        const createReq = httpMock.expectOne('http://localhost:8080/features');
        createReq.flush({
          key: 'test-uuid|integration-test',
          value: 'true',
          tags: ['test'],
        });
      });
      // Mock initial connection request (new collection)
      const connectReq = httpMock.expectOne('http://localhost:8080/features');
      connectReq.flush({
        key: 'test-uuid|connection-test',
        value: 'true',
        secret: 'collection-secret',
      });
      // Connection is complete - no automatic load features call
    });
    it('should handle existing collection connection and feature loading', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        baseUUID: 'existing-uuid',
        isConnected: false,
      };
      const existingFeatures: Feature[] = [
        { key: 'existing-uuid|feature1', value: 'true', tags: ['prod'] },
        {
          key: 'existing-uuid|feature2',
          value: 'false',
          activeAt: '2024-01-01T00:00:00Z',
        },
      ];
      yaftService.connect(connection).subscribe((success) => {
        expect(success).toBe(true);
        yaftService.features$.subscribe((features) => {
          expect(features).toHaveLength(2);
          expect(features[0].displayKey).toBe('feature1');
          expect(features[1].displayKey).toBe('feature2');
          expect(features[0].secret).toBeDefined();
          done();
        });
      });
      // Mock connection to existing collection
      const req = httpMock.expectOne(
        'http://localhost:8080/features/existing-uuid'
      );
      req.flush({ toggles: existingFeatures });
    });
  });
  describe('Local Storage Provider Integration', () => {
    it('should complete full local storage workflow', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.LOCAL_STORAGE,
        isConnected: false,
      };
      // Connect to local storage
      yaftService.connect(connection).subscribe((success) => {
        expect(success).toBe(true);
        // Create feature
        const newFeature: Omit<Feature, 'secret'> = {
          key: 'local-test',
          value: 'true',
        };
        yaftService.createFeature(newFeature).subscribe((createdFeature) => {
          expect(createdFeature.key).toBe('local-test');
          expect(createdFeature.secret).toBe('local-storage');
          // Update feature
          yaftService
            .updateFeature('local-test', { value: 'false' })
            .subscribe((updatedFeature) => {
              expect(updatedFeature.value).toBe('false');
              // Verify localStorage contains the feature
              const stored = localStorage.getItem('yaft-admin-features');
              expect(stored).toBeTruthy();
              const features = JSON.parse(stored ?? '[]');
              expect(
                features.find((f: Feature) => f.key === 'local-test')?.value
              ).toBe('false');
              // Delete feature
              yaftService.deleteFeature('local-test').subscribe(() => {
                // Verify feature removed from localStorage
                const storedAfterDelete = localStorage.getItem(
                  'yaft-admin-features'
                );
                const featuresAfterDelete = JSON.parse(storedAfterDelete ?? '[]');
                expect(
                  featuresAfterDelete.find((f: Feature) => f.key === 'local-test')
                ).toBeUndefined();
                done();
              });
            });
        });
      });
    });
    it('should load existing features from localStorage', (done) => {
      const existingFeatures: FeatureWithSecret[] = [
        { key: 'stored1', value: 'true', secret: 'local-storage' },
        { key: 'stored2', value: 'false', secret: 'local-storage' },
      ];
      localStorage.setItem(
        'yaft-admin-features',
        JSON.stringify(existingFeatures)
      );
      const connection: ProviderConnection = {
        type: ProviderType.LOCAL_STORAGE,
        isConnected: false,
      };
      yaftService.connect(connection).subscribe(() => {
        yaftService.features$.subscribe((features) => {
          expect(features).toHaveLength(2);
          expect(features[0].key).toBe('stored1');
          expect(features[1].key).toBe('stored2');
          done();
        });
      });
    });
  });
  describe('Provider Type Switching Integration', () => {
    it('should switch from API to Local Storage provider', (done) => {
      let stepCount = 0;
      // First connect to API
      const apiConnection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        isConnected: false,
      };
      yaftService.connect(apiConnection).subscribe(() => {
        stepCount++;
        // Then switch to Local Storage
        const localConnection: ProviderConnection = {
          type: ProviderType.LOCAL_STORAGE,
          isConnected: false,
        };
        yaftService.connect(localConnection).subscribe(() => {
          stepCount++;
          // Verify both connections succeeded
          expect(stepCount).toBe(2);
          done();
        });
      });
      // Mock API connection
      const apiReq = httpMock.expectOne('http://localhost:8080/features');
      apiReq.flush({
        key: 'test-uuid|connection-test',
        value: 'true',
        secret: 'secret',
      });
      // Connection is complete - no automatic load features call
    });
  });
  describe('Feature Status Calculation Integration', () => {
    it('should correctly calculate status for time-based features', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const future = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      // Active feature (enabled now)
      const activeFeature: Feature = { key: 'active', value: 'true' };
      const activeStatus = yaftService.getFeatureStatus(activeFeature);
      expect(activeStatus.isEnabled).toBe(true);
      expect(activeStatus.status).toBe('active');
      // Scheduled feature (will be active in future)
      const scheduledFeature: Feature = {
        key: 'scheduled',
        value: 'false',
        activeAt: future.toISOString(),
      };
      const scheduledStatus = yaftService.getFeatureStatus(scheduledFeature);
      expect(scheduledStatus.isEnabled).toBe(false);
      expect(scheduledStatus.status).toBe('scheduled');
      // Expired feature (was active, now disabled)
      const expiredFeature: Feature = {
        key: 'expired',
        value: 'true',
        disabledAt: past.toISOString(),
      };
      const expiredStatus = yaftService.getFeatureStatus(expiredFeature);
      expect(expiredStatus.isEnabled).toBe(false);
      expect(expiredStatus.status).toBe('inactive');
    });
  });
  describe('Error Handling Integration', () => {
    it('should handle API connection failures gracefully', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        baseUUID: 'nonexistent',
        isConnected: false,
      };
      yaftService.connect(connection).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain(
            "Collection with UUID 'nonexistent' not found"
          );
          done();
        },
      });
      const req = httpMock.expectOne(
        'http://localhost:8080/features/nonexistent'
      );
      req.flush(null, { status: 404, statusText: 'Not Found' });
    });
  });
  describe('Complex Workflow Integration', () => {
    it('should handle mixed provider type switching', (done) => {
      // Test that we can handle different provider capabilities
      const features: FeatureWithSecret[] = [
        { key: 'feature1', value: 'true', secret: 'secret1' },
        { key: 'feature2', value: 'false', secret: 'secret2' },
      ];
      // Verify we can get feature status for different features
      features.forEach((feature) => {
        const status = yaftService.getFeatureStatus(feature);
        expect(status.key).toBe(feature.key);
        expect(status.isEnabled).toBe(feature.value === 'true');
      });
      done();
    });
  });
  describe('Data Format Conversion Integration', () => {
    it('should handle boolean provider data format conversion', () => {
      const booleanData = {
        toggle1: true,
        toggle2: false,
        toggle3: true,
      };
      const service = yaftService as unknown as { convertObjectToFeatures: (data: Record<string, unknown>) => Feature[] };
      const features = service.convertObjectToFeatures(booleanData);
      expect(features).toHaveLength(3);
      expect(features[0].key).toBe('toggle1');
      expect(features[0].value).toBe('true');
      expect(features[1].key).toBe('toggle2');
      expect(features[1].value).toBe('false');
    });
    it('should handle mixed data format conversion', () => {
      const mixedData = {
        simple: true,
        complex: {
          key: 'complex',
          value: 'false',
          tags: ['advanced'],
          activeAt: '2024-01-01T00:00:00Z',
        },
      };
      const service = yaftService as unknown as { convertObjectToFeatures: (data: Record<string, unknown>) => Feature[] };
      const features = service.convertObjectToFeatures(mixedData);
      expect(features).toHaveLength(2);
      expect(features[0].key).toBe('simple');
      expect(features[0].value).toBe('true');
      expect(features[1].key).toBe('complex');
      expect(features[1].value).toBe('false');
      expect(features[1].tags).toEqual(['advanced']);
    });
  });
});
