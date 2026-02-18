import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Feature,
  FeatureWithSecret,
  FeatureToggleResponse,
  GoFeatureResponse,
  FeaturesResponse,
  ProviderType,
  ProviderConnection,
  FeatureStatus
} from '../models/feature.model';

@Injectable({
  providedIn: 'root'
})
export class YaftProviderService {
  private http = inject(HttpClient);

  private connectionSubject = new BehaviorSubject<ProviderConnection>({
    type: ProviderType.API_SERVICE,
    isConnected: false
  });

  private featuresSubject = new BehaviorSubject<FeatureWithSecret[]>([]);
  private secretsMap = new Map<string, string>(); // Separate secret storage

  public connection$ = this.connectionSubject.asObservable();
  public features$ = this.featuresSubject.asObservable();

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

    if (connection.baseUUID) {
      // Test existing collection by querying features
      return this.testExistingCollection(connection);
    } else {
      // No baseUUID - create a new collection via POST and get the secret
      return this.createNewCollection(connection);
    }
  }

  private testExistingCollection(connection: ProviderConnection): Observable<boolean> {
    const testUrl = `${connection.apiUrl}/features/${connection.baseUUID}`;
    
    return this.http.get<FeaturesResponse>(testUrl).pipe(
      map((response) => {
        // Successfully connected to existing collection
        connection.isConnected = true;
        this.connectionSubject.next(connection);
        
        // Load the features we just received
        const apiFeatures = response.toggles || response.value || [];
        
        const collectionSecret = this.secretsMap.get('collection-secret');
        const featuresWithSecrets: FeatureWithSecret[] = apiFeatures.map((feature) => {
          
          // Map Go backend capitalized fields to TypeScript lowercase interface
          const f = feature as GoFeatureResponse;
          const normalizedFeature: Feature = {
            key: f.Key || f.key || '',
            value: f.Value || f.value || '',
            activeAt: f.ActiveAt || f.activeAt,
            disabledAt: f.DisabledAt || f.disabledAt,
            tags: f.Tags || f.tags || [],
          };
          
          return {
            ...normalizedFeature,
            displayKey: this.extractDisplayKey(normalizedFeature.key),
            secret: collectionSecret || this.generateMockSecret()
          };
        });
        
        this.featuresSubject.next(featuresWithSecrets);
        return true;
      }),
      catchError((error) => {
        
        connection.isConnected = false;
        this.connectionSubject.next(connection);
        
        if (error.status === 404) {
          return throwError(() => new Error(`Collection with UUID '${connection.baseUUID}' not found`));
        } else if (error.status === 0) {
          return throwError(() => new Error('Cannot reach the API server. Please check if it\'s running and accessible.'));
        } else {
          return throwError(() => new Error(`API connection failed: ${error.status} ${error.statusText || error.message || 'Unknown error'}`));
        }
      })
    );
  }

  private createNewCollection(connection: ProviderConnection): Observable<boolean> {
    // Create a test feature to establish a new collection and get the secret
    const testFeature = {
      key: 'connection-test',
      value: 'true'
    };

    return this.http.post<FeatureToggleResponse>(`${connection.apiUrl}/features`, testFeature).pipe(
      map((r) => {
        // Map Go backend capitalized fields
        const response = r as GoFeatureResponse;
        const responseKey = response.key || response.Key || '';
        const responseSecret = response.secret || response.Secret;

        if (responseSecret) {
          // Store the collection secret for future operations
          this.secretsMap.set('collection-secret', responseSecret);
        }

        // Extract UUID from the key (format: "uuid|feature-name")
        const uuidMatch = responseKey.split('|')[0];
        if (uuidMatch) {
          // Update the connection with the extracted UUID
          connection.baseUUID = uuidMatch;
        }

        connection.isConnected = true;
        this.connectionSubject.next(connection);

        // Start with the test feature we just created
        const newFeature: FeatureWithSecret = {
          key: responseKey,
          value: response.value || response.Value || '',
          activeAt: response.activeAt || response.ActiveAt || null,
          disabledAt: response.disabledAt || response.DisabledAt || null,
          tags: response.tags || response.Tags || [],
          displayKey: this.extractDisplayKey(responseKey),
          secret: responseSecret || 'mock-secret'
        };
        this.featuresSubject.next([newFeature]);
        
        return true;
      }),
      catchError((error) => {
        
        connection.isConnected = false;
        this.connectionSubject.next(connection);
        
        if (error.status === 0) {
          return throwError(() => new Error('Cannot reach the API server. Please check if it\'s running and accessible.'));
        } else {
          return throwError(() => new Error(`Failed to create new collection: ${error.status} ${error.statusText || error.message || 'Unknown error'}`));
        }
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
      error: () => { /* Silently ignore if no features exist */ }
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

    // Only load features if we have a baseUUID - otherwise start with empty list
    if (!connection.baseUUID) {
      // No baseUUID means new collection - start with empty features
      this.featuresSubject.next([]);
      return of([]);
    }

    const url = `${connection.apiUrl}/features/${connection.baseUUID}`;

    return this.http.get<FeaturesResponse>(url).pipe(
      map((response) => {
        const apiFeatures = response.toggles || response.value || [];
        
        // Convert to FeatureWithSecret and use the cached collection secret
        const collectionSecret = this.secretsMap.get('collection-secret');
        const featuresWithSecrets: FeatureWithSecret[] = apiFeatures.map((feature) => {
          
          // Map Go backend capitalized fields to TypeScript lowercase interface
          const f = feature as GoFeatureResponse;
          const normalizedFeature: Feature = {
            key: f.Key || f.key || '',
            value: f.Value || f.value || '',
            activeAt: f.ActiveAt || f.activeAt,
            disabledAt: f.DisabledAt || f.disabledAt,
            tags: f.Tags || f.tags || [],
          };
          
          return {
            ...normalizedFeature,
            // Store full key for API operations, but provide display key
            displayKey: this.extractDisplayKey(normalizedFeature.key),
            secret: collectionSecret || this.generateMockSecret() // Use collection secret for all features
          };
        });
        
        this.featuresSubject.next(featuresWithSecrets);
        return featuresWithSecrets;
      }),
      catchError(() => {
        // If we can't load features, start with empty list but don't fail
        this.featuresSubject.next([]);
        return of([]);
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
      return throwError(() => error);
    }
  }

  private convertObjectToFeatures(data: Record<string, unknown>): Feature[] {
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
            tags: [],
          });
        } else if (typeof value === 'object' && value !== null) {
          // Feature object format: { "toggleName": { key: "toggleName", value: "true", ... } }
          const featureObj = value as Feature;
          features.push({
            key: featureObj.key || key,
            value: featureObj.value === 'true' ? 'true' : 'false',
            activeAt: featureObj.activeAt || null,
            disabledAt: featureObj.disabledAt || null,
            tags: featureObj.tags || [],
          });
        }
      } catch {
        // Skip invalid features silently
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

    // Get the collection secret for existing collection
    const collectionSecret = this.secretsMap.get('collection-secret');
    
    // If we have a baseUUID, prefix the key and include the secret
    let keyToSend = feature.key;
    if (connection.baseUUID && collectionSecret) {
      keyToSend = `${connection.baseUUID}|${feature.key}`;
    }

    const payload: Record<string, unknown> = {
      key: keyToSend,
      value: feature.value,
      activeAt: feature.activeAt ? new Date(feature.activeAt).toISOString() : null,
      disabledAt: feature.disabledAt ? new Date(feature.disabledAt).toISOString() : null,
      tags: feature.tags || []
    };

    // Include secret for existing collections
    if (connection.baseUUID && collectionSecret) {
      payload.secret = collectionSecret;
    }

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
        
        // Map Go backend capitalized fields to TypeScript lowercase interface
        const r = response as GoFeatureResponse;
        const normalizedKey = r.key || r.Key || '';
        const normalizedValue = r.value || r.Value || '';
        const normalizedActiveAt = r.activeAt || r.ActiveAt;
        const normalizedDisabledAt = r.disabledAt || r.DisabledAt;
        const normalizedTags = r.tags || r.Tags || [];
        
        this.secretsMap.set(normalizedKey, secret);
        
        const newFeature: FeatureWithSecret = {
          key: normalizedKey,
          value: normalizedValue,
          activeAt: normalizedActiveAt,
          disabledAt: normalizedDisabledAt,
          tags: normalizedTags,
          displayKey: this.extractDisplayKey(normalizedKey),
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
      map((r) => {
        const response = r as GoFeatureResponse;
        const key = response.key || response.Key || '';
        return {
          key,
          value: response.value || response.Value || '',
          activeAt: response.activeAt || response.ActiveAt,
          disabledAt: response.disabledAt || response.DisabledAt,
          displayKey: this.extractDisplayKey(key),
          secret: collectionSecret
        };
      }),
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

  private updateInLocalStorage(key: string, updates: Partial<Feature>, _secret?: string): Observable<FeatureWithSecret> {
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
      map((r) => {
        const response = r as GoFeatureResponse;
        const key = response.key || response.Key || '';
        return {
          key,
          value: response.value || response.Value || '',
          activeAt: response.activeAt || response.ActiveAt,
          disabledAt: response.disabledAt || response.DisabledAt,
          tags: response.tags || response.Tags || [],
          displayKey: this.extractDisplayKey(key),
          secret: secret
        };
      }),
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
      map((r) => {
        const response = r as GoFeatureResponse;
        const key = response.key || response.Key || '';
        return {
          key,
          value: response.value || response.Value || '',
          activeAt: response.activeAt || response.ActiveAt,
          disabledAt: response.disabledAt || response.DisabledAt,
          tags: response.tags || response.Tags || [],
          displayKey: this.extractDisplayKey(key),
          secret: secret
        };
      }),
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

  private extractDisplayKey(fullKey: string | undefined): string {
    // Handle undefined/null keys
    if (!fullKey) {
      return 'unknown-feature';
    }
    
    // Extract the display name from UUID-prefixed keys (e.g., "uuid|feature-name" -> "feature-name")
    const parts = fullKey.split('|');
    return parts.length > 1 ? parts[1] : fullKey;
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