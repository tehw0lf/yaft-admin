import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { YaftProviderService } from './yaft-provider.service';
import {
  ProviderType,
  ProviderConnection,
  Feature,
  FeatureWithSecret,
  FeatureToggleResponse,
  FeaturesResponse,
  FeatureStatus
} from '../models/feature.model';

describe('YaftProviderService', () => {
  let service: YaftProviderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [YaftProviderService]
    });

    service = TestBed.inject(YaftProviderService);
    httpMock = TestBed.inject(HttpTestingController);

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('Connection Management', () => {
    it('should initialize with default connection state', (done) => {
      service.connection$.subscribe(connection => {
        expect(connection.type).toBe(ProviderType.API_SERVICE);
        expect(connection.isConnected).toBe(false);
        done();
      });
    });

    it('should connect to API service with new collection', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        isConnected: false
      };

      const mockResponse: FeatureToggleResponse = {
        key: 'test-uuid|connection-test',
        value: 'true',
        secret: 'test-secret'
      };

      service.connect(connection).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('http://localhost:8080/features');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ key: 'connection-test', value: 'true' });
      req.flush(mockResponse);
    });

    it('should connect to existing API collection with baseUUID', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        baseUUID: 'existing-uuid',
        isConnected: false
      };

      const mockResponse: FeaturesResponse = {
        toggles: [
          { key: 'existing-uuid|feature1', value: 'true' },
          { key: 'existing-uuid|feature2', value: 'false' }
        ]
      };

      service.connect(connection).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('http://localhost:8080/features/existing-uuid');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should handle API connection failure', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        baseUUID: 'nonexistent-uuid',
        isConnected: false
      };

      service.connect(connection).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Collection with UUID \'nonexistent-uuid\' not found');
          done();
        }
      });

      const req = httpMock.expectOne('http://localhost:8080/features/nonexistent-uuid');
      req.flush(null, { status: 404, statusText: 'Not Found' });
    });

    it('should connect to local storage', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.LOCAL_STORAGE,
        isConnected: false
      };

      service.connect(connection).subscribe(success => {
        expect(success).toBe(true);
        done();
      });
    });
  });

  describe('Feature Loading', () => {
    beforeEach(() => {
      // Setup connected state
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        baseUUID: 'test-uuid',
        isConnected: true
      };
      (service as any).connectionSubject.next(connection);
    });

    it('should load features from API service', (done) => {
      const mockFeatures: Feature[] = [
        { key: 'test-uuid|feature1', value: 'true', tags: ['test'] },
        { key: 'test-uuid|feature2', value: 'false', activeAt: '2024-01-01T00:00:00Z' }
      ];

      service.loadFeatures().subscribe(features => {
        expect(features).toHaveLength(2);
        expect(features[0].key).toBe('test-uuid|feature1');
        expect(features[0].displayKey).toBe('feature1');
        expect(features[0].secret).toBeDefined();
        done();
      });

      const req = httpMock.expectOne('http://localhost:8080/features/test-uuid');
      req.flush({ toggles: mockFeatures });
    });

    it('should load features from local storage', (done) => {
      const mockFeatures: FeatureWithSecret[] = [
        { key: 'feature1', value: 'true', secret: 'local-storage' },
        { key: 'feature2', value: 'false', secret: 'local-storage' }
      ];

      localStorage.setItem('yaft-admin-features', JSON.stringify(mockFeatures));

      const connection: ProviderConnection = {
        type: ProviderType.LOCAL_STORAGE,
        isConnected: true
      };
      (service as any).connectionSubject.next(connection);

      service.loadFeatures().subscribe(features => {
        expect(features).toHaveLength(2);
        expect(features[0].key).toBe('feature1');
        expect(features[0].secret).toBe('local-storage');
        done();
      });
    });
  });

  describe('Feature CRUD Operations', () => {
    beforeEach(() => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        baseUUID: 'test-uuid',
        isConnected: true
      };
      (service as any).connectionSubject.next(connection);
      service.setCollectionSecret('test-secret');
    });

    it('should create feature via API', (done) => {
      const feature: Omit<Feature, 'secret'> = {
        key: 'new-feature',
        value: 'true',
        tags: ['test']
      };

      const mockResponse: FeatureToggleResponse = {
        key: 'test-uuid|new-feature',
        value: 'true',
        tags: ['test']
      };

      service.createFeature(feature).subscribe(newFeature => {
        expect(newFeature.key).toBe('test-uuid|new-feature');
        expect(newFeature.displayKey).toBe('new-feature');
        expect(newFeature.secret).toBe('test-secret');
        done();
      });

      const req = httpMock.expectOne('http://localhost:8080/features');
      expect(req.request.body.key).toBe('test-uuid|new-feature');
      expect(req.request.body.secret).toBe('test-secret');
      req.flush(mockResponse);
    });

    it('should update feature via API', (done) => {
      const updates: Partial<Feature> = { value: 'true' };

      const mockResponse: FeatureToggleResponse = {
        key: 'test-uuid|feature1',
        value: 'true'
      };

      service.updateFeature('test-uuid|feature1', updates, 'test-secret').subscribe(updatedFeature => {
        expect(updatedFeature.value).toBe('true');
        done();
      });

      const req = httpMock.expectOne('http://localhost:8080/features/activate/test-uuid|feature1/test-secret');
      expect(req.request.method).toBe('PUT');
      req.flush(mockResponse);
    });

    it('should delete feature via API', (done) => {
      service.deleteFeature('test-uuid|feature1', 'test-secret').subscribe(() => {
        done();
      });

      const req = httpMock.expectOne('http://localhost:8080/features/test-uuid|feature1/test-secret');
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('should handle CRUD operations for local storage', (done) => {
      const connection: ProviderConnection = {
        type: ProviderType.LOCAL_STORAGE,
        isConnected: true
      };
      (service as any).connectionSubject.next(connection);

      const feature: Omit<Feature, 'secret'> = {
        key: 'local-feature',
        value: 'true'
      };

      let step = 0;

      service.createFeature(feature).subscribe(newFeature => {
        expect(newFeature.key).toBe('local-feature');
        expect(newFeature.secret).toBe('local-storage');
        step++;

        service.updateFeature('local-feature', { value: 'false' }).subscribe(updatedFeature => {
          expect(updatedFeature.value).toBe('false');
          step++;

          service.deleteFeature('local-feature').subscribe(() => {
            const stored = localStorage.getItem('yaft-admin-features');
            const features = stored ? JSON.parse(stored) : [];
            expect(features.find((f: any) => f.key === 'local-feature')).toBeUndefined();
            expect(step).toBe(2);
            done();
          });
        });
      });
    });
  });

  describe('Feature Status Calculation', () => {
    it('should calculate active status for enabled feature', () => {
      const feature: Feature = {
        key: 'test-feature',
        value: 'true'
      };

      const status: FeatureStatus = service.getFeatureStatus(feature);
      expect(status.isEnabled).toBe(true);
      expect(status.status).toBe('active');
    });

    it('should calculate inactive status for disabled feature', () => {
      const feature: Feature = {
        key: 'test-feature',
        value: 'false'
      };

      const status: FeatureStatus = service.getFeatureStatus(feature);
      expect(status.isEnabled).toBe(false);
      expect(status.status).toBe('inactive');
    });

    it('should calculate scheduled status for future activation', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const feature: Feature = {
        key: 'test-feature',
        value: 'false',
        activeAt: tomorrow.toISOString()
      };

      const status: FeatureStatus = service.getFeatureStatus(feature);
      expect(status.isEnabled).toBe(false);
      expect(status.status).toBe('scheduled');
    });

    it('should calculate inactive status for past disable date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const feature: Feature = {
        key: 'test-feature',
        value: 'true',
        disabledAt: yesterday.toISOString()
      };

      const status: FeatureStatus = service.getFeatureStatus(feature);
      expect(status.isEnabled).toBe(false);
      expect(status.status).toBe('inactive');
    });
  });

  describe('Collection Secret Management', () => {
    it('should store and retrieve collection secret', () => {
      expect(service.hasCollectionSecret()).toBe(false);

      service.setCollectionSecret('test-secret');
      expect(service.hasCollectionSecret()).toBe(true);

      service.clearCollectionSecret();
      expect(service.hasCollectionSecret()).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should extract display key from full key', () => {
      const service_any = service as any;
      expect(service_any.extractDisplayKey('uuid|feature-name')).toBe('feature-name');
      expect(service_any.extractDisplayKey('simple-key')).toBe('simple-key');
      expect(service_any.extractDisplayKey(undefined)).toBe('unknown-feature');
    });

    it('should convert object to features array', () => {
      const service_any = service as any;
      const data = {
        'toggle1': true,
        'toggle2': false,
        'toggle3': { key: 'toggle3', value: 'true', tags: ['test'] }
      };

      const features = service_any.convertObjectToFeatures(data);
      expect(features).toHaveLength(3);
      expect(features[0].key).toBe('toggle1');
      expect(features[0].value).toBe('true');
      expect(features[2].tags).toEqual(['test']);
    });
  });
});