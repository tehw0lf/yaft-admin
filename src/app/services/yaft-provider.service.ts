import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  Feature, 
  FeatureWithSecret,
  FeatureToggleResponse, 
  FeaturesResponse, 
  ProviderType, 
  ProviderConnection,
  FeatureStatus
} from '../models/feature.model';

@Injectable({
  providedIn: 'root'
})
export class YaftProviderService {
  private connectionSubject = new BehaviorSubject<ProviderConnection>({
    type: ProviderType.API_SERVICE,
    isConnected: false
  });

  private featuresSubject = new BehaviorSubject<FeatureWithSecret[]>([]);
  private secretsMap = new Map<string, string>(); // Separate secret storage

  public connection$ = this.connectionSubject.asObservable();
  public features$ = this.featuresSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Connection Management
  connect(connection: ProviderConnection): Observable<boolean> {
    switch (connection.type) {
      case ProviderType.API_SERVICE:
      case ProviderType.API_SERVICE_BOOLEAN:
        return this.connectToApiService(connection);
      case ProviderType.LOCAL_STORAGE:
      case ProviderType.LOCAL_STORAGE_BOOLEAN:
        return this.connectToLocalStorage(connection);
      default:
        return throwError(() => new Error('Unsupported provider type'));
    }
  }

  private connectToApiService(connection: ProviderConnection): Observable<boolean> {
    if (!connection.apiUrl) {
      return throwError(() => new Error('API URL is required'));
    }

    // Test connection by trying to fetch collection hash or a simple health check
    const testUrl = connection.baseUUID 
      ? `${connection.apiUrl}/collectionHash/${connection.baseUUID}`
      : `${connection.apiUrl}/features/test`;

    return this.http.get(testUrl).pipe(
      map(() => {
        connection.isConnected = true;
        this.connectionSubject.next(connection);
        // Always load features on successful connection
        this.loadFeatures().subscribe({
          error: (error) => console.warn('Failed to load initial features:', error)
        });
        return true;
      }),
      catchError((error) => {
        connection.isConnected = false;
        this.connectionSubject.next(connection);
        return throwError(() => error);
      })
    );
  }

  private connectToLocalStorage(connection: ProviderConnection): Observable<boolean> {
    // For local storage, we simulate a connection test
    // Note: Browser security prevents direct file system access
    connection.isConnected = true;
    this.connectionSubject.next(connection);
    
    // Try to load features, but don't fail if none exist yet
    this.loadFeatures().subscribe({
      error: (error) => console.warn('No existing local features found:', error)
    });
    
    return of(true);
  }

  // Feature Management
  loadFeatures(): Observable<FeatureWithSecret[]> {
    const connection = this.connectionSubject.value;
    if (!connection.isConnected) {
      return throwError(() => new Error('No active connection'));
    }

    switch (connection.type) {
      case ProviderType.API_SERVICE:
      case ProviderType.API_SERVICE_BOOLEAN:
        return this.loadFromApiService();
      case ProviderType.LOCAL_STORAGE:
      case ProviderType.LOCAL_STORAGE_BOOLEAN:
        return this.loadFromLocalStorage();
      default:
        return throwError(() => new Error('Unsupported provider type'));
    }
  }

  private loadFromApiService(): Observable<FeatureWithSecret[]> {
    const connection = this.connectionSubject.value;
    if (!connection.apiUrl) {
      return throwError(() => new Error('API URL not configured'));
    }

    const url = connection.baseUUID 
      ? `${connection.apiUrl}/features/${connection.baseUUID}`
      : `${connection.apiUrl}/features`;

    return this.http.get<FeaturesResponse>(url).pipe(
      map((response) => {
        const apiFeatures = response.toggles || response.value || [];
        // Convert to FeatureWithSecret and generate secrets for admin UI
        const featuresWithSecrets: FeatureWithSecret[] = apiFeatures.map(feature => {
          const secret = this.secretsMap.get(feature.key) || this.generateMockSecret();
          this.secretsMap.set(feature.key, secret);
          
          return {
            ...feature,
            secret: secret // Admin UI only - not from API
          };
        });
        
        this.featuresSubject.next(featuresWithSecrets);
        return featuresWithSecrets;
      }),
      catchError((error) => {
        console.error('Failed to load features:', error);
        return throwError(() => error);
      })
    );
  }

  private loadFromLocalStorage(): Observable<FeatureWithSecret[]> {
    // For local storage provider, we use browser localStorage
    // Note: Actual file reading requires user to import via file picker
    try {
      // Use a simple storage key for local storage features
      const storageKey = 'yaft-admin-features';
      const storedData = localStorage.getItem(storageKey);
      
      let features: Feature[] = [];
      
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        
        if (Array.isArray(parsedData)) {
          // Direct array format
          features = parsedData;
        } else if (typeof parsedData === 'object') {
          // Object format - convert using same logic as import
          features = this.convertObjectToFeatures(parsedData);
        }
      }
      
      // Convert to FeatureWithSecret - local storage doesn't need real secrets
      const featuresWithSecrets: FeatureWithSecret[] = features.map(feature => ({
        ...feature,
        secret: 'local-storage' // Placeholder for UI compatibility
      }));
      
      this.featuresSubject.next(featuresWithSecrets);
      return of(featuresWithSecrets);
    } catch (error) {
      console.error('Failed to load from local storage:', error);
      return throwError(() => error);
    }
  }

  private convertObjectToFeatures(data: any): Feature[] {
    const features: Feature[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      try {
        if (typeof value === 'boolean' || value === 'true' || value === 'false') {
          // Boolean format: { "toggleName": true }
          features.push({
            key: key,
            value: value === true || value === 'true' ? 'true' : 'false',
            activeAt: null,
            disabledAt: null,
          });
        } else if (typeof value === 'object' && value !== null) {
          // Feature object format: { "toggleName": { key: "toggleName", value: "true", ... } }
          const featureObj = value as any;
          features.push({
            key: featureObj.key || key,
            value: featureObj.value === true || featureObj.value === 'true' ? 'true' : 'false',
            activeAt: featureObj.activeAt || null,
            disabledAt: featureObj.disabledAt || null,
          });
        }
      } catch (error) {
        console.warn(`Failed to convert feature '${key}':`, error);
      }
    }
    
    return features;
  }

  // CRUD Operations
  createFeature(feature: Omit<Feature, 'secret'>): Observable<FeatureWithSecret> {
    const connection = this.connectionSubject.value;
    if (!connection.isConnected) {
      return throwError(() => new Error('No active connection'));
    }

    switch (connection.type) {
      case ProviderType.API_SERVICE:
      case ProviderType.API_SERVICE_BOOLEAN:
        return this.createInApiService(feature);
      case ProviderType.LOCAL_STORAGE:
      case ProviderType.LOCAL_STORAGE_BOOLEAN:
        return this.createInLocalStorage(feature);
      default:
        return throwError(() => new Error('Unsupported provider type'));
    }
  }

  private createInApiService(feature: Omit<Feature, 'secret'>): Observable<FeatureWithSecret> {
    const connection = this.connectionSubject.value;
    if (!connection.apiUrl) {
      return throwError(() => new Error('API URL not configured'));
    }

    const payload = {
      key: feature.key,
      value: feature.value,
      activeAt: feature.activeAt ? new Date(feature.activeAt).toISOString() : null,
      disabledAt: feature.disabledAt ? new Date(feature.disabledAt).toISOString() : null
    };

    return this.http.post<FeatureToggleResponse>(`${connection.apiUrl}/features`, payload).pipe(
      map((response) => {
        let secret: string;
        
        if (response.secret) {
          // Backend returned secret - this is a new collection creation
          secret = response.secret;
          this.secretsMap.set('collection-secret', secret); // Cache for future operations
          console.log('New collection created with secret');
        } else {
          // Existing collection - use cached secret
          secret = this.secretsMap.get('collection-secret') || '';
          if (!secret) {
            throw new Error('No collection secret available. Please set collection secret first.');
          }
        }
        
        this.secretsMap.set(response.key, secret);
        
        const newFeature: FeatureWithSecret = {
          key: response.key,
          value: response.value,
          activeAt: response.activeAt,
          disabledAt: response.disabledAt,
          secret: secret // From backend or cached collection secret
        };
        
        // Update local features list
        const currentFeatures = this.featuresSubject.value;
        this.featuresSubject.next([...currentFeatures, newFeature]);
        
        return newFeature;
      }),
      catchError((error) => {
        console.error('Failed to create feature:', error);
        return throwError(() => error);
      })
    );
  }

  private createInLocalStorage(feature: Omit<Feature, 'secret'>): Observable<FeatureWithSecret> {
    try {
      const currentFeatures = this.featuresSubject.value;
      
      // Local storage doesn't need secrets - all operations are client-side
      const newFeature: FeatureWithSecret = {
        ...feature,
        secret: 'local-storage' // Placeholder for UI compatibility
      };
      
      const updatedFeatures = [...currentFeatures, newFeature];
      localStorage.setItem('yaft-admin-features', JSON.stringify(updatedFeatures));
      this.featuresSubject.next(updatedFeatures);
      
      return of(newFeature);
    } catch (error) {
      return throwError(() => error);
    }
  }

  updateFeature(key: string, updates: Partial<Feature>, secret?: string): Observable<FeatureWithSecret> {
    const connection = this.connectionSubject.value;
    if (!connection.isConnected) {
      return throwError(() => new Error('No active connection'));
    }

    switch (connection.type) {
      case ProviderType.API_SERVICE:
      case ProviderType.API_SERVICE_BOOLEAN:
        return this.updateInApiService(key, updates, secret);
      case ProviderType.LOCAL_STORAGE:
      case ProviderType.LOCAL_STORAGE_BOOLEAN:
        return this.updateInLocalStorage(key, updates, secret);
      default:
        return throwError(() => new Error('Unsupported provider type'));
    }
  }

  private updateInApiService(key: string, updates: Partial<Feature>, secret?: string): Observable<FeatureWithSecret> {
    const connection = this.connectionSubject.value;
    if (!connection.apiUrl) {
      return throwError(() => new Error('API URL not configured'));
    }
    
    // Use provided secret or cached collection secret
    const collectionSecret = secret || this.secretsMap.get('collection-secret');
    if (!collectionSecret) {
      return throwError(() => new Error('No collection secret available. Please set collection secret first.'));
    }

    // Check if it's just a simple enable/disable operation
    if (Object.keys(updates).length === 1 && updates.value !== undefined) {
      if (updates.value === 'true') {
        return this.activateFeature(key, collectionSecret);
      } else if (updates.value === 'false') {
        return this.deactivateFeature(key, collectionSecret);
      }
    }

    // For comprehensive updates, try a general update approach
    // Note: This requires the YaFT API to support comprehensive updates
    const payload = {
      value: updates.value,
      activeAt: updates.activeAt ? new Date(updates.activeAt).toISOString() : null,
      disabledAt: updates.disabledAt ? new Date(updates.disabledAt).toISOString() : null,
    };

    return this.http.put<FeatureToggleResponse>(`${connection.apiUrl}/features/${key}`, payload, {
      headers: { 'Authorization': `Bearer ${collectionSecret}` }
    }).pipe(
      map((response) => ({
        key: response.key,
        value: response.value,
        activeAt: response.activeAt,
        disabledAt: response.disabledAt,
        secret: collectionSecret
      })),
      catchError((error) => {
        // Fallback to simple enable/disable if comprehensive update fails
        console.warn('Comprehensive update failed, falling back to simple toggle:', error);
        if (updates.value === 'true') {
          return this.activateFeature(key, collectionSecret);
        } else if (updates.value === 'false') {
          return this.deactivateFeature(key, collectionSecret);
        }
        return throwError(() => new Error('Feature update not supported by API'));
      })
    );
  }

  private updateInLocalStorage(key: string, updates: Partial<Feature>, secret?: string): Observable<FeatureWithSecret> {
    try {
      const currentFeatures = this.featuresSubject.value;
      const featureIndex = currentFeatures.findIndex(f => f.key === key);
      
      if (featureIndex === -1) {
        return throwError(() => new Error('Feature not found'));
      }

      const updatedFeature: FeatureWithSecret = { 
        ...currentFeatures[featureIndex], 
        ...updates,
        // Local storage uses placeholder secret
        secret: 'local-storage'
      };
      
      const updatedFeatures = [...currentFeatures];
      updatedFeatures[featureIndex] = updatedFeature;

      localStorage.setItem('yaft-admin-features', JSON.stringify(updatedFeatures));
      this.featuresSubject.next(updatedFeatures);

      return of(updatedFeature);
    } catch (error) {
      return throwError(() => error);
    }
  }

  deleteFeature(key: string, secret?: string): Observable<void> {
    const connection = this.connectionSubject.value;
    if (!connection.isConnected) {
      return throwError(() => new Error('No active connection'));
    }

    switch (connection.type) {
      case ProviderType.API_SERVICE:
      case ProviderType.API_SERVICE_BOOLEAN:
        return this.deleteFromApiService(key, secret);
      case ProviderType.LOCAL_STORAGE:
      case ProviderType.LOCAL_STORAGE_BOOLEAN:
        return this.deleteFromLocalStorage(key);
      default:
        return throwError(() => new Error('Unsupported provider type'));
    }
  }

  private deleteFromApiService(key: string, secret?: string): Observable<void> {
    const connection = this.connectionSubject.value;
    if (!connection.apiUrl) {
      return throwError(() => new Error('API URL not configured'));
    }
    
    // Use provided secret or cached collection secret
    const collectionSecret = secret || this.secretsMap.get('collection-secret');
    if (!collectionSecret) {
      return throwError(() => new Error('No collection secret available. Please set collection secret first.'));
    }

    return this.http.delete<void>(`${connection.apiUrl}/features/${key}/${collectionSecret}`).pipe(
      map(() => {
        // Remove from local features list
        const currentFeatures = this.featuresSubject.value;
        const updatedFeatures = currentFeatures.filter(f => f.key !== key);
        this.featuresSubject.next(updatedFeatures);
      }),
      catchError((error) => {
        console.error('Failed to delete feature:', error);
        return throwError(() => error);
      })
    );
  }

  private deleteFromLocalStorage(key: string): Observable<void> {
    try {
      const currentFeatures = this.featuresSubject.value;
      const updatedFeatures = currentFeatures.filter(f => f.key !== key);
      localStorage.setItem('yaft-admin-features', JSON.stringify(updatedFeatures));
      this.featuresSubject.next(updatedFeatures);
      return of(void 0);
    } catch (error) {
      return throwError(() => error);
    }
  }

  // Specific YaFT API operations
  private activateFeature(key: string, secret: string): Observable<FeatureWithSecret> {
    const connection = this.connectionSubject.value;
    if (!connection.apiUrl) {
      return throwError(() => new Error('API URL not configured'));
    }

    return this.http.put<FeatureToggleResponse>(
      `${connection.apiUrl}/features/activate/${key}/${secret}`, 
      {}
    ).pipe(
      map((response) => ({
        key: response.key,
        value: response.value,
        activeAt: response.activeAt,
        disabledAt: response.disabledAt,
        secret: secret
      })),
      catchError((error) => throwError(() => error))
    );
  }

  private deactivateFeature(key: string, secret: string): Observable<FeatureWithSecret> {
    const connection = this.connectionSubject.value;
    if (!connection.apiUrl) {
      return throwError(() => new Error('API URL not configured'));
    }

    return this.http.put<FeatureToggleResponse>(
      `${connection.apiUrl}/features/deactivate/${key}/${secret}`, 
      {}
    ).pipe(
      map((response) => ({
        key: response.key,
        value: response.value,
        activeAt: response.activeAt,
        disabledAt: response.disabledAt,
        secret: secret
      })),
      catchError((error) => throwError(() => error))
    );
  }

  // Utility methods
  getFeatureStatus(feature: Feature): FeatureStatus {
    const now = new Date();
    const activeAt = feature.activeAt ? new Date(feature.activeAt) : null;
    const disabledAt = feature.disabledAt ? new Date(feature.disabledAt) : null;

    let isEnabled = feature.value === 'true';
    let status: 'active' | 'inactive' | 'scheduled' = 'inactive';

    if (disabledAt && now >= disabledAt) {
      isEnabled = false;
      status = 'inactive';
    } else if (activeAt && now >= activeAt) {
      isEnabled = true;
      status = 'active';
    } else if (activeAt && now < activeAt) {
      status = 'scheduled';
      isEnabled = false;
    } else {
      status = isEnabled ? 'active' : 'inactive';
    }

    return {
      key: feature.key,
      isEnabled,
      status,
      activeAt,
      disabledAt
    };
  }

  private generateMockSecret(): string {
    return 'mock-secret-' + Math.random().toString(36).substring(2, 15);
  }

  getCurrentConnection(): ProviderConnection {
    return this.connectionSubject.value;
  }

  getCurrentFeatures(): Feature[] {
    return this.featuresSubject.value;
  }

  // Collection secret management for existing collections
  setCollectionSecret(secret: string): void {
    this.secretsMap.set('collection-secret', secret);
  }

  hasCollectionSecret(): boolean {
    return this.secretsMap.has('collection-secret') && !!this.secretsMap.get('collection-secret');
  }

  clearCollectionSecret(): void {
    this.secretsMap.delete('collection-secret');
  }
}