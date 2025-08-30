import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  Feature, 
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

  private featuresSubject = new BehaviorSubject<Feature[]>([]);

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
        if (connection.baseUUID) {
          this.loadFeatures();
        }
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
    // In a real implementation, this might validate file access or structure
    connection.isConnected = true;
    this.connectionSubject.next(connection);
    this.loadFeatures();
    return of(true);
  }

  // Feature Management
  loadFeatures(): Observable<Feature[]> {
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

  private loadFromApiService(): Observable<Feature[]> {
    const connection = this.connectionSubject.value;
    if (!connection.apiUrl) {
      return throwError(() => new Error('API URL not configured'));
    }

    const url = connection.baseUUID 
      ? `${connection.apiUrl}/features/${connection.baseUUID}`
      : `${connection.apiUrl}/features`;

    return this.http.get<FeaturesResponse>(url).pipe(
      map((response) => {
        const features = response.toggles || response.value || [];
        this.featuresSubject.next(features);
        return features;
      }),
      catchError((error) => {
        console.error('Failed to load features:', error);
        return throwError(() => error);
      })
    );
  }

  private loadFromLocalStorage(): Observable<Feature[]> {
    // For local storage provider, we would typically read from a JSON file
    // Since we're in browser environment, we'll use localStorage or simulate file reading
    try {
      const storedFeatures = localStorage.getItem('yaft-features');
      const features: Feature[] = storedFeatures ? JSON.parse(storedFeatures) : [];
      this.featuresSubject.next(features);
      return of(features);
    } catch (error) {
      console.error('Failed to load from local storage:', error);
      return throwError(() => error);
    }
  }

  // CRUD Operations
  createFeature(feature: Omit<Feature, 'secret'>): Observable<Feature> {
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

  private createInApiService(feature: Omit<Feature, 'secret'>): Observable<Feature> {
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
        const newFeature: Feature = {
          key: response.key,
          value: response.value,
          activeAt: response.activeAt,
          disabledAt: response.disabledAt,
          secret: response.secret,
          tags: response.tags || []
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

  private createInLocalStorage(feature: Omit<Feature, 'secret'>): Observable<Feature> {
    try {
      const currentFeatures = this.featuresSubject.value;
      const newFeature: Feature = {
        ...feature,
        secret: this.generateMockSecret(),
        tags: feature.tags || []
      };
      
      const updatedFeatures = [...currentFeatures, newFeature];
      localStorage.setItem('yaft-features', JSON.stringify(updatedFeatures));
      this.featuresSubject.next(updatedFeatures);
      
      return of(newFeature);
    } catch (error) {
      return throwError(() => error);
    }
  }

  updateFeature(key: string, updates: Partial<Feature>, secret?: string): Observable<Feature> {
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
        return this.updateInLocalStorage(key, updates);
      default:
        return throwError(() => new Error('Unsupported provider type'));
    }
  }

  private updateInApiService(key: string, updates: Partial<Feature>, secret?: string): Observable<Feature> {
    const connection = this.connectionSubject.value;
    if (!connection.apiUrl || !secret) {
      return throwError(() => new Error('API URL and secret are required'));
    }

    // YaFT API has specific endpoints for different operations
    if (updates.value === 'true') {
      return this.activateFeature(key, secret);
    } else if (updates.value === 'false') {
      return this.deactivateFeature(key, secret);
    }

    // For other updates, we might need to use a general update endpoint
    // This would need to be implemented in the YaFT API
    return throwError(() => new Error('General feature updates not supported yet'));
  }

  private updateInLocalStorage(key: string, updates: Partial<Feature>): Observable<Feature> {
    try {
      const currentFeatures = this.featuresSubject.value;
      const featureIndex = currentFeatures.findIndex(f => f.key === key);
      
      if (featureIndex === -1) {
        return throwError(() => new Error('Feature not found'));
      }

      const updatedFeature = { ...currentFeatures[featureIndex], ...updates };
      const updatedFeatures = [...currentFeatures];
      updatedFeatures[featureIndex] = updatedFeature;

      localStorage.setItem('yaft-features', JSON.stringify(updatedFeatures));
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
    if (!connection.apiUrl || !secret) {
      return throwError(() => new Error('API URL and secret are required'));
    }

    return this.http.delete<void>(`${connection.apiUrl}/features/${key}/${secret}`).pipe(
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
      localStorage.setItem('yaft-features', JSON.stringify(updatedFeatures));
      this.featuresSubject.next(updatedFeatures);
      return of(void 0);
    } catch (error) {
      return throwError(() => error);
    }
  }

  // Specific YaFT API operations
  private activateFeature(key: string, secret: string): Observable<Feature> {
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
        disabledAt: response.disabledAt
      })),
      catchError((error) => throwError(() => error))
    );
  }

  private deactivateFeature(key: string, secret: string): Observable<Feature> {
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
        disabledAt: response.disabledAt
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
}