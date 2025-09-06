import {
  Feature,
  FeatureWithSecret,
  FeatureToggleResponse,
  FeatureStatus,
  ProviderType,
  ProviderConnection,
  FeatureFilter
} from './feature.model';

describe('Feature Models', () => {
  describe('Feature Interface', () => {
    it('should create a valid feature with required fields', () => {
      const feature: Feature = {
        key: 'test-feature',
        value: 'true'
      };

      expect(feature.key).toBe('test-feature');
      expect(feature.value).toBe('true');
      expect(feature.activeAt).toBeUndefined();
      expect(feature.disabledAt).toBeUndefined();
      expect(feature.tags).toBeUndefined();
    });

    it('should create a feature with all optional fields', () => {
      const feature: Feature = {
        key: 'advanced-feature',
        value: 'false',
        activeAt: '2024-01-01T00:00:00Z',
        disabledAt: '2024-12-31T23:59:59Z',
        tags: ['test', 'experimental']
      };

      expect(feature.activeAt).toBe('2024-01-01T00:00:00Z');
      expect(feature.disabledAt).toBe('2024-12-31T23:59:59Z');
      expect(feature.tags).toEqual(['test', 'experimental']);
    });

    it('should allow null values for optional date fields', () => {
      const feature: Feature = {
        key: 'nullable-dates',
        value: 'true',
        activeAt: null,
        disabledAt: null
      };

      expect(feature.activeAt).toBeNull();
      expect(feature.disabledAt).toBeNull();
    });
  });

  describe('FeatureWithSecret Interface', () => {
    it('should extend Feature with secret and displayKey', () => {
      const featureWithSecret: FeatureWithSecret = {
        key: 'uuid|feature-name',
        value: 'true',
        secret: 'secret-key',
        displayKey: 'feature-name'
      };

      expect(featureWithSecret.key).toBe('uuid|feature-name');
      expect(featureWithSecret.secret).toBe('secret-key');
      expect(featureWithSecret.displayKey).toBe('feature-name');
    });

    it('should work without secret for local storage features', () => {
      const localFeature: FeatureWithSecret = {
        key: 'local-feature',
        value: 'false'
      };

      expect(localFeature.secret).toBeUndefined();
      expect(localFeature.displayKey).toBeUndefined();
    });
  });

  describe('FeatureStatus Interface', () => {
    it('should create valid active status', () => {
      const status: FeatureStatus = {
        key: 'active-feature',
        isEnabled: true,
        status: 'active'
      };

      expect(status.isEnabled).toBe(true);
      expect(status.status).toBe('active');
    });

    it('should create valid inactive status', () => {
      const status: FeatureStatus = {
        key: 'inactive-feature',
        isEnabled: false,
        status: 'inactive'
      };

      expect(status.isEnabled).toBe(false);
      expect(status.status).toBe('inactive');
    });

    it('should create valid scheduled status with dates', () => {
      const activeDate = new Date('2024-06-01T00:00:00Z');
      const disabledDate = new Date('2024-12-01T00:00:00Z');

      const status: FeatureStatus = {
        key: 'scheduled-feature',
        isEnabled: false,
        status: 'scheduled',
        activeAt: activeDate,
        disabledAt: disabledDate
      };

      expect(status.status).toBe('scheduled');
      expect(status.activeAt).toBe(activeDate);
      expect(status.disabledAt).toBe(disabledDate);
    });
  });

  describe('ProviderType Enum', () => {
    it('should have correct values for all provider types', () => {
      expect(ProviderType.API_SERVICE).toBe('api-service');
      expect(ProviderType.LOCAL_STORAGE).toBe('local-storage');
      expect(ProviderType.API_SERVICE_BOOLEAN).toBe('api-service-boolean');
      expect(ProviderType.LOCAL_STORAGE_BOOLEAN).toBe('local-storage-boolean');
    });

    it('should distinguish between object and boolean providers', () => {
      const objectProviders = [ProviderType.API_SERVICE, ProviderType.LOCAL_STORAGE];
      const booleanProviders = [ProviderType.API_SERVICE_BOOLEAN, ProviderType.LOCAL_STORAGE_BOOLEAN];

      expect(objectProviders.every(type => !type.includes('boolean'))).toBe(true);
      expect(booleanProviders.every(type => type.includes('boolean'))).toBe(true);
    });

    it('should distinguish between API and local storage providers', () => {
      const apiProviders = [ProviderType.API_SERVICE, ProviderType.API_SERVICE_BOOLEAN];
      const localProviders = [ProviderType.LOCAL_STORAGE, ProviderType.LOCAL_STORAGE_BOOLEAN];

      expect(apiProviders.every(type => type.includes('api-service'))).toBe(true);
      expect(localProviders.every(type => type.includes('local-storage'))).toBe(true);
    });
  });

  describe('ProviderConnection Interface', () => {
    it('should create API service connection', () => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE,
        apiUrl: 'http://localhost:8080',
        baseUUID: 'test-uuid',
        isConnected: true
      };

      expect(connection.type).toBe(ProviderType.API_SERVICE);
      expect(connection.apiUrl).toBe('http://localhost:8080');
      expect(connection.baseUUID).toBe('test-uuid');
      expect(connection.isConnected).toBe(true);
    });

    it('should create local storage connection', () => {
      const connection: ProviderConnection = {
        type: ProviderType.LOCAL_STORAGE,
        configPath: '/path/to/config.json',
        isConnected: false
      };

      expect(connection.type).toBe(ProviderType.LOCAL_STORAGE);
      expect(connection.configPath).toBe('/path/to/config.json');
      expect(connection.apiUrl).toBeUndefined();
      expect(connection.baseUUID).toBeUndefined();
    });

    it('should create minimal connection', () => {
      const connection: ProviderConnection = {
        type: ProviderType.API_SERVICE_BOOLEAN,
        isConnected: false
      };

      expect(connection.type).toBe(ProviderType.API_SERVICE_BOOLEAN);
      expect(connection.isConnected).toBe(false);
    });
  });

  describe('FeatureFilter Interface', () => {
    it('should create empty filter', () => {
      const filter: FeatureFilter = {
        searchText: '',
        status: [],
        tags: [],
        dateRange: {
          start: null,
          end: null
        }
      };

      expect(filter.searchText).toBe('');
      expect(filter.status).toEqual([]);
      expect(filter.tags).toEqual([]);
      expect(filter.dateRange.start).toBeNull();
      expect(filter.dateRange.end).toBeNull();
    });

    it('should create populated filter', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const filter: FeatureFilter = {
        searchText: 'feature-name',
        status: ['active', 'scheduled'],
        tags: ['production', 'experimental'],
        dateRange: {
          start: startDate,
          end: endDate
        }
      };

      expect(filter.searchText).toBe('feature-name');
      expect(filter.status).toEqual(['active', 'scheduled']);
      expect(filter.tags).toEqual(['production', 'experimental']);
      expect(filter.dateRange.start).toBe(startDate);
      expect(filter.dateRange.end).toBe(endDate);
    });
  });

  describe('FeatureToggleResponse Interface', () => {
    it('should create basic response', () => {
      const response: FeatureToggleResponse = {
        key: 'test-feature',
        value: 'true'
      };

      expect(response.key).toBe('test-feature');
      expect(response.value).toBe('true');
    });

    it('should create response with collection hash and secret', () => {
      const response: FeatureToggleResponse = {
        key: 'uuid|new-feature',
        value: 'false',
        activeAt: '2024-06-01T00:00:00Z',
        disabledAt: null,
        tags: ['new'],
        collectionHash: 'abc123',
        secret: 'secret-token'
      };

      expect(response.collectionHash).toBe('abc123');
      expect(response.secret).toBe('secret-token');
      expect(response.activeAt).toBe('2024-06-01T00:00:00Z');
      expect(response.disabledAt).toBeNull();
      expect(response.tags).toEqual(['new']);
    });
  });

  describe('Type Compatibility', () => {
    it('should allow Feature to be assigned to FeatureWithSecret', () => {
      const feature: Feature = {
        key: 'base-feature',
        value: 'true',
        tags: ['test']
      };

      // This should compile without error
      const featureWithSecret: FeatureWithSecret = {
        ...feature,
        secret: 'added-secret'
      };

      expect(featureWithSecret.key).toBe('base-feature');
      expect(featureWithSecret.secret).toBe('added-secret');
    });

    it('should allow FeatureToggleResponse to match Feature structure', () => {
      const response: FeatureToggleResponse = {
        key: 'response-feature',
        value: 'false',
        activeAt: '2024-01-01T00:00:00Z',
        disabledAt: '2024-12-31T23:59:59Z',
        tags: ['api']
      };

      // Should be compatible with Feature interface
      const feature: Feature = {
        key: response.key,
        value: response.value,
        activeAt: response.activeAt,
        disabledAt: response.disabledAt,
        tags: response.tags
      };

      expect(feature.key).toBe(response.key);
      expect(feature.value).toBe(response.value);
    });
  });
});