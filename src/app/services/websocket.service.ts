import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer, EMPTY } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { takeUntil, retry, catchError, tap, delayWhen } from 'rxjs/operators';
import { ErrorHandlerService } from './error-handler.service';
import { Feature } from '../models/feature.model';

export interface WebSocketMessage {
  type: 'feature_update' | 'feature_create' | 'feature_delete' | 'connection_status' | 'heartbeat';
  data: any;
  timestamp: string;
  userId?: string;
}

export interface FeatureUpdateMessage {
  feature: Feature;
  action: 'create' | 'update' | 'delete';
  userId: string;
  userName?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastPing?: Date;
  reconnectAttempts: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private socket$?: WebSocketSubject<WebSocketMessage>;
  private isConnectedSubject = new BehaviorSubject<ConnectionStatus>({
    isConnected: false,
    reconnectAttempts: 0
  });
  
  // Message subjects for different types
  private featureUpdatesSubject = new Subject<FeatureUpdateMessage>();
  private heartbeatSubject = new Subject<Date>();
  
  // Configuration
  private wsUrl = 'ws://localhost:8080/ws'; // Default WebSocket URL
  private reconnectInterval = 5000;
  private maxReconnectAttempts = 10;
  private heartbeatInterval = 30000;
  
  // Public observables
  public connectionStatus$ = this.isConnectedSubject.asObservable();
  public featureUpdates$ = this.featureUpdatesSubject.asObservable();
  public heartbeat$ = this.heartbeatSubject.asObservable();
  
  constructor(private errorHandler: ErrorHandlerService) {
    this.setupHeartbeat();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }

  // Connect to WebSocket with automatic retry
  connect(wsUrl?: string): void {
    if (wsUrl) {
      this.wsUrl = wsUrl;
    }
    
    if (this.socket$) {
      this.disconnect();
    }

    this.createConnection();
  }

  // Disconnect from WebSocket
  disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = undefined;
    }
    
    this.updateConnectionStatus({
      isConnected: false,
      reconnectAttempts: 0
    });
  }

  // Send message to WebSocket
  sendMessage(message: Omit<WebSocketMessage, 'timestamp'>): void {
    if (this.socket$ && this.isConnectedSubject.value.isConnected) {
      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString()
      };
      
      this.socket$.next(fullMessage);
    } else {
      this.errorHandler.showWarningNotification('Not connected to WebSocket');
    }
  }

  // Send feature update notification
  notifyFeatureUpdate(feature: Feature, action: 'create' | 'update' | 'delete'): void {
    this.sendMessage({
      type: 'feature_update',
      data: {
        feature,
        action,
        userId: this.getCurrentUserId()
      }
    });
  }

  // Check if WebSocket is connected
  isConnected(): boolean {
    return this.isConnectedSubject.value.isConnected;
  }

  // Get current connection status
  getConnectionStatus(): ConnectionStatus {
    return this.isConnectedSubject.value;
  }

  private createConnection(): void {
    try {
      this.socket$ = webSocket<WebSocketMessage>({
        url: this.wsUrl,
        openObserver: {
          next: () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus({
              isConnected: true,
              reconnectAttempts: 0,
              lastPing: new Date()
            });
            this.errorHandler.showSuccessNotification('Real-time updates enabled');
          }
        },
        closeObserver: {
          next: () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus({
              isConnected: false,
              reconnectAttempts: this.isConnectedSubject.value.reconnectAttempts
            });
            this.scheduleReconnect();
          }
        }
      });

      // Subscribe to messages
      this.socket$
        .pipe(
          takeUntil(this.destroy$),
          retry({
            count: this.maxReconnectAttempts,
            delay: (error, retryCount) => {
              // Rationale: `retryCount` is an internal RxJS retry counter, not user input. JS template literals are not printf-style format strings.
              // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
              console.log(`WebSocket retry attempt ${retryCount}:`, error);
              this.updateConnectionStatus({
                isConnected: false,
                reconnectAttempts: retryCount,
                error: error.message || 'Connection failed'
              });
              return timer(this.reconnectInterval * retryCount);
            }
          }),
          catchError(error => {
            console.error('WebSocket error:', error);
            this.errorHandler.showErrorNotification('Real-time connection failed');
            this.updateConnectionStatus({
              isConnected: false,
              reconnectAttempts: this.maxReconnectAttempts,
              error: error.message || 'Connection failed'
            });
            return EMPTY;
          })
        )
        .subscribe(message => {
          this.handleMessage(message);
        });

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.errorHandler.showErrorNotification('Failed to establish real-time connection');
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'feature_update':
        this.handleFeatureUpdate(message.data);
        break;
      
      case 'feature_create':
        this.handleFeatureUpdate({ ...message.data, action: 'create' });
        break;
      
      case 'feature_delete':
        this.handleFeatureUpdate({ ...message.data, action: 'delete' });
        break;
      
      case 'heartbeat':
        this.handleHeartbeat();
        break;
      
      case 'connection_status':
        console.log('Connection status update:', message.data);
        break;
      
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private handleFeatureUpdate(data: FeatureUpdateMessage): void {
    // Don't process updates from current user to avoid echo
    if (data.userId === this.getCurrentUserId()) {
      return;
    }
    
    this.featureUpdatesSubject.next(data);
    
    // Show notification for updates from other users
    const userName = data.userName || 'Another user';
    const action = data.action === 'create' ? 'created' : 
                  data.action === 'update' ? 'updated' : 'deleted';
    
    this.errorHandler.showInfoNotification(
      `${userName} ${action} feature "${data.feature.key}"`,
      3000
    );
  }

  private handleHeartbeat(): void {
    this.heartbeatSubject.next(new Date());
    this.updateConnectionStatus({
      ...this.isConnectedSubject.value,
      lastPing: new Date()
    });
  }

  private scheduleReconnect(): void {
    const currentStatus = this.isConnectedSubject.value;
    
    if (currentStatus.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectInterval * (currentStatus.reconnectAttempts + 1);
      
      timer(delay)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          console.log(`Attempting to reconnect (${currentStatus.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          this.createConnection();
        });
    } else {
      this.errorHandler.showErrorNotification('Real-time connection failed after multiple attempts');
    }
  }

  private setupHeartbeat(): void {
    timer(0, this.heartbeatInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isConnected()) {
          this.sendMessage({
            type: 'heartbeat',
            data: { timestamp: Date.now() }
          });
        }
      });
  }

  private updateConnectionStatus(status: Partial<ConnectionStatus>): void {
    const currentStatus = this.isConnectedSubject.value;
    this.isConnectedSubject.next({
      ...currentStatus,
      ...status
    });
  }

  private getCurrentUserId(): string {
    // In a real application, this would come from authentication
    // For now, generate a session-based ID
    let userId = localStorage.getItem('yaft-user-id');
    if (!userId) {
      userId = 'user-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('yaft-user-id', userId);
    }
    return userId;
  }

  // Utility methods for connection management
  enableOptimisticUpdates(): void {
    // Store in localStorage for persistence
    localStorage.setItem('yaft-optimistic-updates', 'true');
  }

  disableOptimisticUpdates(): void {
    localStorage.setItem('yaft-optimistic-updates', 'false');
  }

  isOptimisticUpdatesEnabled(): boolean {
    return localStorage.getItem('yaft-optimistic-updates') !== 'false';
  }

  // Configure WebSocket settings
  configure(options: {
    wsUrl?: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
  }): void {
    if (options.wsUrl) this.wsUrl = options.wsUrl;
    if (options.reconnectInterval) this.reconnectInterval = options.reconnectInterval;
    if (options.maxReconnectAttempts) this.maxReconnectAttempts = options.maxReconnectAttempts;
    if (options.heartbeatInterval) this.heartbeatInterval = options.heartbeatInterval;
  }
}