export interface Feature {
  key: string;
  value: string;
  activeAt?: string | null;
  disabledAt?: string | null;
  secret?: string;
}

export interface FeatureToggleResponse {
  key: string;
  value: string;
  activeAt?: string | null;
  disabledAt?: string | null;
  secret?: string;
  collectionHash?: string;
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