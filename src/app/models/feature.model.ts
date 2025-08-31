export interface Feature {
  key: string;
  value: string;
  activeAt?: string | null;
  disabledAt?: string | null;
}

export interface FeatureToggleResponse {
  key: string;
  value: string;
  activeAt?: string | null;
  disabledAt?: string | null;
  collectionHash?: string;
  secret?: string; // Only returned on new collection creation
}

export interface CollectionHashResponse {
  collectionHash: string;
}

export interface FeaturesResponse {
  toggles?: Feature[];
  value?: Feature[];
}

export enum ProviderType {
  API_SERVICE = 'api-service',
  LOCAL_STORAGE = 'local-storage',
  API_SERVICE_BOOLEAN = 'api-service-boolean',
  LOCAL_STORAGE_BOOLEAN = 'local-storage-boolean'
}

export interface ProviderConnection {
  type: ProviderType;
  apiUrl?: string;
  baseUUID?: string;
  configPath?: string;
  isConnected: boolean;
}

export interface FeatureStatus {
  key: string;
  isEnabled: boolean;
  status: 'active' | 'inactive' | 'scheduled';
  activeAt?: Date | null;
  disabledAt?: Date | null;
}

export interface FeatureFilter {
  searchText: string;
  status: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

// Separate interface for managing secrets (not part of feature data)
export interface FeatureSecret {
  key: string;
  secret: string;
}

// Extended feature interface for admin UI that includes secret management
export interface FeatureWithSecret extends Feature {
  secret?: string; // Only available in admin UI, never returned from API
}