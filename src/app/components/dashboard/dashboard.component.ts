import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, map, combineLatest } from 'rxjs';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { YaftProviderService } from '../../services/yaft-provider.service';
import { FilterService } from '../../services/filter.service';
import { Feature, FeatureStatus } from '../../models/feature.model';

export interface DashboardMetrics {
  totalFeatures: number;
  activeFeatures: number;
  inactiveFeatures: number;
  scheduledFeatures: number;
  recentlyCreated: Feature[];
  upcomingScheduled: Feature[];
  mostUsedTags: { tag: string; count: number }[];
  connectionStatus: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h2>
          <mat-icon>dashboard</mat-icon>
          YaFT Dashboard
        </h2>
        <p class="dashboard-subtitle">Feature Toggle Overview & Analytics</p>
      </div>

      <!-- Connection Status Banner -->
      <mat-card class="status-banner" [class]="getStatusClass()">
        <mat-card-content>
          <div class="status-content">
            <mat-icon>{{getStatusIcon()}}</mat-icon>
            <div class="status-text">
              <strong>{{getStatusTitle()}}</strong>
              <span>{{getStatusMessage()}}</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Metrics Overview -->
      <div class="metrics-grid">
        <!-- Total Features -->
        <mat-card class="metric-card total-features">
          <mat-card-content>
            <div class="metric-icon">
              <mat-icon>toggle_on</mat-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{metrics.totalFeatures}}</div>
              <div class="metric-label">Total Features</div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Active Features -->
        <mat-card class="metric-card active-features">
          <mat-card-content>
            <div class="metric-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{metrics.activeFeatures}}</div>
              <div class="metric-label">Active</div>
              <div class="metric-percentage">
                {{getPercentage(metrics.activeFeatures, metrics.totalFeatures)}}%
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Inactive Features -->
        <mat-card class="metric-card inactive-features">
          <mat-card-content>
            <div class="metric-icon">
              <mat-icon>cancel</mat-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{metrics.inactiveFeatures}}</div>
              <div class="metric-label">Inactive</div>
              <div class="metric-percentage">
                {{getPercentage(metrics.inactiveFeatures, metrics.totalFeatures)}}%
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Scheduled Features -->
        <mat-card class="metric-card scheduled-features">
          <mat-card-content>
            <div class="metric-icon">
              <mat-icon>schedule</mat-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{metrics.scheduledFeatures}}</div>
              <div class="metric-label">Scheduled</div>
              <div class="metric-percentage">
                {{getPercentage(metrics.scheduledFeatures, metrics.totalFeatures)}}%
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Activity Progress Bar -->
      <mat-card class="progress-card">
        <mat-card-header>
          <mat-card-title>Feature Activity Distribution</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="progress-container">
            <mat-progress-bar 
              mode="buffer" 
              [value]="getActivePercentage()" 
              [bufferValue]="getActivePercentage() + getScheduledPercentage()">
            </mat-progress-bar>
            <div class="progress-legend">
              <div class="legend-item">
                <div class="legend-color active"></div>
                <span>Active ({{metrics.activeFeatures}})</span>
              </div>
              <div class="legend-item">
                <div class="legend-color scheduled"></div>
                <span>Scheduled ({{metrics.scheduledFeatures}})</span>
              </div>
              <div class="legend-item">
                <div class="legend-color inactive"></div>
                <span>Inactive ({{metrics.inactiveFeatures}})</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Two Column Layout -->
      <div class="dashboard-columns">
        <!-- Left Column -->
        <div class="dashboard-column">
          <!-- Recent Features -->
          <mat-card class="recent-features-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>fiber_new</mat-icon>
                Recent Features
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div *ngIf="metrics.recentlyCreated.length === 0" class="empty-state">
                <mat-icon>info</mat-icon>
                <p>No recent features</p>
              </div>
              <div *ngFor="let feature of metrics.recentlyCreated" class="feature-item">
                <div class="feature-key">{{feature.key}}</div>
                <div class="feature-status">
                  <mat-chip [class]="'status-chip status-' + getFeatureStatus(feature).status">
                    {{getFeatureStatus(feature).status | titlecase}}
                  </mat-chip>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Most Used Tags -->
          <mat-card class="tags-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>local_offer</mat-icon>
                Popular Tags
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div *ngIf="metrics.mostUsedTags.length === 0" class="empty-state">
                <mat-icon>info</mat-icon>
                <p>No tags used yet</p>
              </div>
              <div *ngFor="let tagInfo of metrics.mostUsedTags" class="tag-stat">
                <mat-chip [matTooltip]="tagInfo.count + ' features'">
                  {{tagInfo.tag}}
                </mat-chip>
                <div class="tag-count">{{tagInfo.count}}</div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Right Column -->
        <div class="dashboard-column">
          <!-- Upcoming Scheduled -->
          <mat-card class="scheduled-features-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>upcoming</mat-icon>
                Upcoming Changes
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div *ngIf="metrics.upcomingScheduled.length === 0" class="empty-state">
                <mat-icon>info</mat-icon>
                <p>No scheduled changes</p>
              </div>
              <div *ngFor="let feature of metrics.upcomingScheduled" class="scheduled-item">
                <div class="scheduled-info">
                  <div class="feature-key">{{feature.key}}</div>
                  <div class="scheduled-time">
                    <mat-icon>schedule</mat-icon>
                    <span>{{getNextScheduledTime(feature)}}</span>
                  </div>
                </div>
                <div class="scheduled-action">
                  {{getScheduledAction(feature)}}
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Quick Actions -->
          <mat-card class="quick-actions-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>flash_on</mat-icon>
                Quick Actions
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="quick-actions">
                <button mat-raised-button color="primary" (click)="onCreateFeature()">
                  <mat-icon>add</mat-icon>
                  Create Feature
                </button>
                <button mat-raised-button (click)="onRefreshData()">
                  <mat-icon>refresh</mat-icon>
                  Refresh Data
                </button>
                <button mat-raised-button (click)="onExportAll()">
                  <mat-icon>download</mat-icon>
                  Export All
                </button>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .dashboard-header {
      text-align: center;
      margin-bottom: 32px;
      
      h2 {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 0 0 8px 0;
        color: #333;
        
        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }
      
      .dashboard-subtitle {
        color: #666;
        margin: 0;
        font-size: 16px;
      }
    }

    .status-banner {
      margin-bottom: 24px;
      
      &.connected {
        background: linear-gradient(135deg, #e8f5e8, #f1f8e9);
        border-left: 4px solid #4caf50;
      }
      
      &.disconnected {
        background: linear-gradient(135deg, #fce4ec, #ffebee);
        border-left: 4px solid #f44336;
      }
      
      .status-content {
        display: flex;
        align-items: center;
        gap: 16px;
        
        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
        
        .status-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          
          strong {
            font-size: 16px;
          }
          
          span {
            color: #666;
            font-size: 14px;
          }
        }
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .metric-card {
      .mat-card-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
      }
      
      .metric-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        
        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
          color: white;
        }
      }
      
      .metric-info {
        flex: 1;
        
        .metric-value {
          font-size: 28px;
          font-weight: bold;
          line-height: 1;
          margin-bottom: 4px;
        }
        
        .metric-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 2px;
        }
        
        .metric-percentage {
          font-size: 12px;
          color: #999;
        }
      }
      
      &.total-features .metric-icon {
        background: linear-gradient(135deg, #673ab7, #9c27b0);
      }
      
      &.active-features .metric-icon {
        background: linear-gradient(135deg, #4caf50, #66bb6a);
      }
      
      &.inactive-features .metric-icon {
        background: linear-gradient(135deg, #f44336, #ef5350);
      }
      
      &.scheduled-features .metric-icon {
        background: linear-gradient(135deg, #ff9800, #ffa726);
      }
    }

    .progress-card {
      margin-bottom: 24px;
      
      .progress-container {
        .progress-legend {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          
          @media (max-width: 768px) {
            flex-direction: column;
            gap: 8px;
          }
          
          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            
            .legend-color {
              width: 16px;
              height: 16px;
              border-radius: 2px;
              
              &.active { background: #4caf50; }
              &.scheduled { background: #ff9800; }
              &.inactive { background: #f44336; }
            }
          }
        }
      }
    }

    .dashboard-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      
      @media (max-width: 968px) {
        grid-template-columns: 1fr;
      }
    }

    .dashboard-column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
      
      &:last-child {
        border-bottom: none;
      }
      
      .feature-key {
        font-weight: 500;
        flex: 1;
      }
      
      .feature-status {
        flex-shrink: 0;
      }
      
      .feature-tags {
        mat-chip-set {
          margin: 0;
        }
        
        mat-chip {
          font-size: 11px;
          height: 18px;
          
          &.more-tags {
            background: #e0e0e0;
            color: #666;
          }
        }
      }
    }

    .tag-stat {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      
      .tag-count {
        background: #f5f5f5;
        color: #666;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
      }
    }

    .scheduled-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
      
      &:last-child {
        border-bottom: none;
      }
      
      .scheduled-info {
        flex: 1;
        
        .feature-key {
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .scheduled-time {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #666;
          font-size: 14px;
          
          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }
      }
      
      .scheduled-action {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        color: white;
        background: #ff9800;
      }
    }

    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      
      button {
        justify-content: flex-start;
        
        mat-icon {
          margin-right: 8px;
        }
      }
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: #999;
      
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }
      
      p {
        margin: 0;
        font-style: italic;
      }
    }

    .status-chip {
      font-size: 11px;
      min-height: 20px;
      
      &.status-active {
        background-color: #e8f5e8;
        color: #2e7d32;
      }
      
      &.status-inactive {
        background-color: #fce4ec;
        color: #c2185b;
      }
      
      &.status-scheduled {
        background-color: #fff8e1;
        color: #f57c00;
      }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  metrics: DashboardMetrics = {
    totalFeatures: 0,
    activeFeatures: 0,
    inactiveFeatures: 0,
    scheduledFeatures: 0,
    recentlyCreated: [],
    upcomingScheduled: [],
    mostUsedTags: [],
    connectionStatus: 'disconnected'
  };

  constructor(
    private yaftService: YaftProviderService,
    private filterService: FilterService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    combineLatest([
      this.yaftService.features$,
      this.yaftService.connection$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([features, connection]) => {
        this.updateMetrics(features, connection);
      });
  }

  private updateMetrics(features: Feature[], connection: any): void {
    const now = new Date();
    
    // Basic counts
    this.metrics.totalFeatures = features.length;
    this.metrics.connectionStatus = connection.isConnected ? 'connected' : 'disconnected';
    
    // Status counts
    let activeCount = 0;
    let inactiveCount = 0;
    let scheduledCount = 0;
    
    features.forEach(feature => {
      const status = this.yaftService.getFeatureStatus(feature);
      switch (status.status) {
        case 'active':
          activeCount++;
          break;
        case 'inactive':
          inactiveCount++;
          break;
        case 'scheduled':
          scheduledCount++;
          break;
      }
    });
    
    this.metrics.activeFeatures = activeCount;
    this.metrics.inactiveFeatures = inactiveCount;
    this.metrics.scheduledFeatures = scheduledCount;
    
    // Recent features (last 5, simulated by first 5 for demo)
    this.metrics.recentlyCreated = features.slice(0, 5);
    
    // Upcoming scheduled (features with future activeAt or disabledAt)
    this.metrics.upcomingScheduled = features
      .filter(feature => {
        const activeAt = feature.activeAt ? new Date(feature.activeAt) : null;
        const disabledAt = feature.disabledAt ? new Date(feature.disabledAt) : null;
        return (activeAt && activeAt > now) || (disabledAt && disabledAt > now);
      })
      .slice(0, 5);
    
    // Most used tags (removed - not supported by YaFT library)
    this.metrics.mostUsedTags = [];
  }

  getStatusClass(): string {
    return this.metrics.connectionStatus;
  }

  getStatusIcon(): string {
    return this.metrics.connectionStatus === 'connected' ? 'wifi' : 'wifi_off';
  }

  getStatusTitle(): string {
    return this.metrics.connectionStatus === 'connected' ? 'Connected' : 'Disconnected';
  }

  getStatusMessage(): string {
    return this.metrics.connectionStatus === 'connected' 
      ? 'Successfully connected to data source'
      : 'No active connection to data source';
  }

  getPercentage(value: number, total: number): number {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  }

  getActivePercentage(): number {
    return this.getPercentage(this.metrics.activeFeatures, this.metrics.totalFeatures);
  }

  getScheduledPercentage(): number {
    return this.getPercentage(this.metrics.scheduledFeatures, this.metrics.totalFeatures);
  }

  getFeatureStatus(feature: Feature): FeatureStatus {
    return this.yaftService.getFeatureStatus(feature);
  }

  getNextScheduledTime(feature: Feature): string {
    const now = new Date();
    const activeAt = feature.activeAt ? new Date(feature.activeAt) : null;
    const disabledAt = feature.disabledAt ? new Date(feature.disabledAt) : null;
    
    if (activeAt && activeAt > now) {
      return activeAt.toLocaleDateString() + ' ' + activeAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    if (disabledAt && disabledAt > now) {
      return disabledAt.toLocaleDateString() + ' ' + disabledAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    return '';
  }

  getScheduledAction(feature: Feature): string {
    const now = new Date();
    const activeAt = feature.activeAt ? new Date(feature.activeAt) : null;
    const disabledAt = feature.disabledAt ? new Date(feature.disabledAt) : null;
    
    if (activeAt && activeAt > now) {
      return 'Activate';
    }
    
    if (disabledAt && disabledAt > now) {
      return 'Deactivate';
    }
    
    return '';
  }

  onCreateFeature(): void {
    // Navigate to create feature section (to be implemented)
    console.log('Navigate to create feature');
  }

  onRefreshData(): void {
    // Trigger data refresh
    this.yaftService.loadFeatures().subscribe();
  }

  onExportAll(): void {
    // Trigger export (to be connected to export service)
    console.log('Export all features');
  }
}