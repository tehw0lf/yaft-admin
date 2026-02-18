import { Component, OnInit, OnDestroy, inject } from '@angular/core';

import { Subject, takeUntil, combineLatest } from 'rxjs';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';

import { YaftProviderService } from '../../services/yaft-provider.service';
import { TemplateService } from '../../services/template.service';
import { Feature } from '../../models/feature.model';
import { FeatureTemplate, TemplateUsage } from '../../models/template.model';

export interface Insight {
  type: 'success' | 'warning' | 'info';
  icon: string;
  title: string;
  description: string;
  actionLabel: string | null;
}

export interface AnalyticsData {
  featureMetrics: {
    total: number;
    active: number;
    inactive: number;
    scheduled: number;
    percentages: {
      active: number;
      inactive: number;
      scheduled: number;
    };
  };
  
  tagAnalytics: {
    tag: string;
    count: number;
    percentage: number;
    growth?: number;
  }[];
  
  activityMetrics: {
    recentCreated: number;
    recentUpdated: number;
    upcomingScheduled: number;
    soonToExpire: number;
  };
  
  timeSeriesData: {
    date: string;
    active: number;
    inactive: number;
    total: number;
  }[];
  
  templateUsage: {
    templateName: string;
    usage: number;
    percentage: number;
  }[];
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
    MatTabsModule,
    MatProgressBarModule,
    MatChipsModule
],
  template: `
    <div class="analytics-container">
      <div class="analytics-header">
        <h2>
          <mat-icon>analytics</mat-icon>
          Analytics & Insights
        </h2>
        <p class="analytics-subtitle">Comprehensive feature toggle analytics and performance metrics</p>
    
        <div class="header-controls">
          <mat-form-field appearance="outline">
            <mat-label>Time Range</mat-label>
            <mat-select [(value)]="selectedTimeRange" (selectionChange)="onTimeRangeChange()">
              <mat-option value="7d">Last 7 days</mat-option>
              <mat-option value="30d">Last 30 days</mat-option>
              <mat-option value="90d">Last 90 days</mat-option>
              <mat-option value="1y">Last year</mat-option>
            </mat-select>
          </mat-form-field>
    
          <button mat-raised-button (click)="refreshData()" [disabled]="isLoading">
            <mat-icon [class.spinning]="isLoading">refresh</mat-icon>
            Refresh
          </button>
        </div>
      </div>
    
      <div class="analytics-grid">
        <!-- Overview Metrics -->
        <mat-card class="metrics-overview-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>dashboard</mat-icon>
              Overview Metrics
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metrics-grid">
              <div class="metric-item total">
                <div class="metric-value">{{analyticsData.featureMetrics.total}}</div>
                <div class="metric-label">Total Features</div>
              </div>
              <div class="metric-item active">
                <div class="metric-value">{{analyticsData.featureMetrics.active}}</div>
                <div class="metric-label">Active</div>
                <div class="metric-percentage">{{analyticsData.featureMetrics.percentages.active}}%</div>
              </div>
              <div class="metric-item inactive">
                <div class="metric-value">{{analyticsData.featureMetrics.inactive}}</div>
                <div class="metric-label">Inactive</div>
                <div class="metric-percentage">{{analyticsData.featureMetrics.percentages.inactive}}%</div>
              </div>
              <div class="metric-item scheduled">
                <div class="metric-value">{{analyticsData.featureMetrics.scheduled}}</div>
                <div class="metric-label">Scheduled</div>
                <div class="metric-percentage">{{analyticsData.featureMetrics.percentages.scheduled}}%</div>
              </div>
            </div>
    
            <!-- Visual Distribution Chart -->
            <div class="distribution-chart">
              <h4>Feature Status Distribution</h4>
              <div class="chart-container">
                <div class="pie-chart">
                  <svg viewBox="0 0 200 200" class="pie-svg">
                    <circle cx="100" cy="100" r="80"
                      fill="none"
                      stroke="#4caf50"
                      stroke-width="40"
                      [attr.stroke-dasharray]="getPieSegment(analyticsData.featureMetrics.percentages.active) + ' ' + (100 - getPieSegment(analyticsData.featureMetrics.percentages.active))"
                      stroke-dashoffset="25"
                      class="pie-segment active-segment">
                    </circle>
                    <circle cx="100" cy="100" r="80"
                      fill="none"
                      stroke="#f44336"
                      stroke-width="40"
                      [attr.stroke-dasharray]="getPieSegment(analyticsData.featureMetrics.percentages.inactive) + ' ' + (100 - getPieSegment(analyticsData.featureMetrics.percentages.inactive))"
                      [attr.stroke-dashoffset]="25 - getPieSegment(analyticsData.featureMetrics.percentages.active)"
                      class="pie-segment inactive-segment">
                    </circle>
                    <circle cx="100" cy="100" r="80"
                      fill="none"
                      stroke="#ff9800"
                      stroke-width="40"
                      [attr.stroke-dasharray]="getPieSegment(analyticsData.featureMetrics.percentages.scheduled) + ' ' + (100 - getPieSegment(analyticsData.featureMetrics.percentages.scheduled))"
                      [attr.stroke-dashoffset]="25 - getPieSegment(analyticsData.featureMetrics.percentages.active) - getPieSegment(analyticsData.featureMetrics.percentages.inactive)"
                      class="pie-segment scheduled-segment">
                    </circle>
                  </svg>
                </div>
                <div class="chart-legend">
                  <div class="legend-item">
                    <div class="legend-color active"></div>
                    <span>Active ({{analyticsData.featureMetrics.percentages.active}}%)</span>
                  </div>
                  <div class="legend-item">
                    <div class="legend-color inactive"></div>
                    <span>Inactive ({{analyticsData.featureMetrics.percentages.inactive}}%)</span>
                  </div>
                  <div class="legend-item">
                    <div class="legend-color scheduled"></div>
                    <span>Scheduled ({{analyticsData.featureMetrics.percentages.scheduled}}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
    
        <!-- Tag Analytics -->
        <mat-card class="tag-analytics-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>local_offer</mat-icon>
              Tag Analytics
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (analyticsData.tagAnalytics.length === 0) {
              <div class="empty-state">
                <mat-icon>info</mat-icon>
                <p>No tags found</p>
              </div>
            }
    
            @for (tag of analyticsData.tagAnalytics; track tag) {
              <div class="tag-metric">
                <div class="tag-info">
                  <mat-chip>{{tag.tag}}</mat-chip>
                  <span class="tag-count">{{tag.count}} features</span>
                </div>
                <div class="tag-progress">
                  <mat-progress-bar mode="determinate" [value]="tag.percentage"></mat-progress-bar>
                  <span class="percentage">{{tag.percentage}}%</span>
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>
    
        <!-- Activity Metrics -->
        <mat-card class="activity-metrics-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>timeline</mat-icon>
              Recent Activity
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="activity-grid">
              <div class="activity-item">
                <div class="activity-icon created">
                  <mat-icon>add_circle</mat-icon>
                </div>
                <div class="activity-info">
                  <div class="activity-value">{{analyticsData.activityMetrics.recentCreated}}</div>
                  <div class="activity-label">Recently Created</div>
                </div>
              </div>
    
              <div class="activity-item">
                <div class="activity-icon updated">
                  <mat-icon>edit</mat-icon>
                </div>
                <div class="activity-info">
                  <div class="activity-value">{{analyticsData.activityMetrics.recentUpdated}}</div>
                  <div class="activity-label">Recently Updated</div>
                </div>
              </div>
    
              <div class="activity-item">
                <div class="activity-icon scheduled">
                  <mat-icon>schedule</mat-icon>
                </div>
                <div class="activity-info">
                  <div class="activity-value">{{analyticsData.activityMetrics.upcomingScheduled}}</div>
                  <div class="activity-label">Upcoming Changes</div>
                </div>
              </div>
    
              <div class="activity-item">
                <div class="activity-icon expiring">
                  <mat-icon>warning</mat-icon>
                </div>
                <div class="activity-info">
                  <div class="activity-value">{{analyticsData.activityMetrics.soonToExpire}}</div>
                  <div class="activity-label">Soon to Expire</div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
    
        <!-- Template Usage -->
        <mat-card class="template-usage-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>library_books</mat-icon>
              Template Usage
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (analyticsData.templateUsage.length === 0) {
              <div class="empty-state">
                <mat-icon>info</mat-icon>
                <p>No template usage data</p>
              </div>
            }
    
            @for (template of analyticsData.templateUsage; track template) {
              <div class="template-metric">
                <div class="template-info">
                  <span class="template-name">{{template.templateName}}</span>
                  <span class="template-usage">{{template.usage}} uses</span>
                </div>
                <div class="template-progress">
                  <mat-progress-bar mode="determinate" [value]="template.percentage"></mat-progress-bar>
                  <span class="percentage">{{template.percentage}}%</span>
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>
    
        <!-- Trend Analysis -->
        <mat-card class="trend-analysis-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>trending_up</mat-icon>
              Trend Analysis
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="trend-chart">
              <h4>Feature Trends Over Time</h4>
              <div class="line-chart-container">
                <svg viewBox="0 0 400 200" class="line-chart">
                  <!-- Grid lines -->
                  <defs>
                    <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" stroke-width="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
    
                  <!-- Sample trend line for active features -->
                  <polyline
                    points="0,150 50,140 100,120 150,110 200,100 250,90 300,85 350,80 400,75"
                    fill="none"
                    stroke="#4caf50"
                    stroke-width="3"
                    class="trend-line active-trend">
                  </polyline>
    
                  <!-- Sample trend line for inactive features -->
                  <polyline
                    points="0,80 50,85 100,90 150,95 200,100 250,105 300,110 350,115 400,120"
                    fill="none"
                    stroke="#f44336"
                    stroke-width="3"
                    class="trend-line inactive-trend">
                  </polyline>
                </svg>
              </div>
              <div class="trend-legend">
                <div class="legend-item">
                  <div class="legend-color active"></div>
                  <span>Active Features Trend</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color inactive"></div>
                  <span>Inactive Features Trend</span>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
    
        <!-- Performance Insights -->
        <mat-card class="insights-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>lightbulb</mat-icon>
              Performance Insights
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="insights-list">
              @for (insight of getInsights(); track insight) {
                <div class="insight-item">
                  <div class="insight-icon" [class]="insight.type">
                    <mat-icon>{{insight.icon}}</mat-icon>
                  </div>
                  <div class="insight-content">
                    <h4>{{insight.title}}</h4>
                    <p>{{insight.description}}</p>
                  </div>
                  @if (insight.actionLabel) {
                    <div class="insight-action">
                      <button mat-button color="primary">{{insight.actionLabel}}</button>
                    </div>
                  }
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
    `,
  styles: [`
    .analytics-container {
      padding: 24px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .analytics-header {
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
      
      .analytics-subtitle {
        color: #666;
        margin: 0 0 24px 0;
        font-size: 16px;
      }
      
      .header-controls {
        display: flex;
        justify-content: center;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
      }
    }

    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
    }

    .metrics-overview-card {
      grid-column: 1 / -1;
      
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 24px;
        margin-bottom: 32px;
      }
      
      .metric-item {
        text-align: center;
        padding: 20px;
        border-radius: 12px;
        
        &.total {
          background: linear-gradient(135deg, #673ab7, #9c27b0);
          color: white;
        }
        
        &.active {
          background: linear-gradient(135deg, #4caf50, #66bb6a);
          color: white;
        }
        
        &.inactive {
          background: linear-gradient(135deg, #f44336, #ef5350);
          color: white;
        }
        
        &.scheduled {
          background: linear-gradient(135deg, #ff9800, #ffa726);
          color: white;
        }
        
        .metric-value {
          font-size: 32px;
          font-weight: bold;
          line-height: 1;
          margin-bottom: 8px;
        }
        
        .metric-label {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 4px;
        }
        
        .metric-percentage {
          font-size: 12px;
          opacity: 0.8;
        }
      }
      
      .distribution-chart {
        h4 {
          text-align: center;
          margin-bottom: 24px;
          color: #333;
        }
        
        .chart-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 32px;
          
          @media (max-width: 768px) {
            flex-direction: column;
          }
        }
        
        .pie-chart {
          width: 200px;
          height: 200px;
          
          .pie-svg {
            width: 100%;
            height: 100%;
            transform: rotate(-90deg);
          }
          
          .pie-segment {
            transition: all 0.3s ease;
            
            &:hover {
              stroke-width: 45;
            }
          }
        }
        
        .chart-legend {
          display: flex;
          flex-direction: column;
          gap: 12px;
          
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
              &.inactive { background: #f44336; }
              &.scheduled { background: #ff9800; }
            }
          }
        }
      }
    }

    .tag-analytics-card, .template-usage-card {
      .tag-metric, .template-metric {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
        
        &:last-child {
          border-bottom: none;
        }
        
        .tag-info, .template-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          
          .tag-count, .template-usage {
            font-size: 12px;
            color: #666;
          }
        }
        
        .tag-progress, .template-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 150px;
          
          mat-progress-bar {
            flex: 1;
          }
          
          .percentage {
            font-size: 12px;
            color: #666;
            width: 35px;
            text-align: right;
          }
        }
      }
    }

    .activity-metrics-card {
      .activity-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      
      .activity-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border-radius: 8px;
        background: #f9f9f9;
        
        .activity-icon {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          
          &.created { background: #4caf50; color: white; }
          &.updated { background: #2196f3; color: white; }
          &.scheduled { background: #ff9800; color: white; }
          &.expiring { background: #f44336; color: white; }
          
          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }
        
        .activity-info {
          .activity-value {
            font-size: 24px;
            font-weight: bold;
            line-height: 1;
            margin-bottom: 4px;
          }
          
          .activity-label {
            font-size: 12px;
            color: #666;
          }
        }
      }
    }

    .trend-analysis-card {
      grid-column: 1 / -1;
      
      .trend-chart {
        h4 {
          text-align: center;
          margin-bottom: 24px;
          color: #333;
        }
        
        .line-chart-container {
          margin-bottom: 16px;
          
          .line-chart {
            width: 100%;
            height: 200px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
          }
          
          .trend-line {
            &.active-trend {
              filter: drop-shadow(2px 2px 4px rgba(76, 175, 80, 0.3));
            }
            
            &.inactive-trend {
              filter: drop-shadow(2px 2px 4px rgba(244, 67, 54, 0.3));
            }
          }
        }
        
        .trend-legend {
          display: flex;
          justify-content: center;
          gap: 24px;
          
          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            
            .legend-color {
              width: 16px;
              height: 3px;
              border-radius: 2px;
              
              &.active { background: #4caf50; }
              &.inactive { background: #f44336; }
            }
          }
        }
      }
    }

    .insights-card {
      grid-column: 1 / -1;
      
      .insights-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .insight-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        transition: all 0.2s ease;
        
        &:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .insight-icon {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          
          &.success { background: #e8f5e8; color: #4caf50; }
          &.warning { background: #fff8e1; color: #ff9800; }
          &.info { background: #e3f2fd; color: #2196f3; }
          
          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }
        
        .insight-content {
          flex: 1;
          
          h4 {
            margin: 0 0 4px 0;
            font-size: 16px;
            font-weight: 500;
          }
          
          p {
            margin: 0;
            color: #666;
            font-size: 14px;
            line-height: 1.4;
          }
        }
        
        .insight-action {
          flex-shrink: 0;
        }
      }
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
      
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      p {
        margin: 0;
        font-style: italic;
      }
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  private yaftService = inject(YaftProviderService);
  private templateService = inject(TemplateService);

  private destroy$ = new Subject<void>();
  
  selectedTimeRange = '30d';
  isLoading = false;
  
  analyticsData: AnalyticsData = {
    featureMetrics: {
      total: 0,
      active: 0,
      inactive: 0,
      scheduled: 0,
      percentages: { active: 0, inactive: 0, scheduled: 0 }
    },
    tagAnalytics: [],
    activityMetrics: {
      recentCreated: 0,
      recentUpdated: 0,
      upcomingScheduled: 0,
      soonToExpire: 0
    },
    timeSeriesData: [],
    templateUsage: []
  };

  ngOnInit(): void {
    this.loadAnalyticsData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAnalyticsData(): void {
    this.isLoading = true;
    
    combineLatest([
      this.yaftService.features$,
      this.templateService.templates$,
      this.templateService.usageHistory$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([features, templates, usageHistory]) => {
        this.calculateAnalytics(features, templates, usageHistory);
        this.isLoading = false;
      });
  }

  private calculateAnalytics(features: Feature[], templates: FeatureTemplate[], _usageHistory: TemplateUsage[]): void {
    // Feature metrics
    const total = features.length;
    let active = 0;
    let inactive = 0;
    let scheduled = 0;
    
    features.forEach(feature => {
      const status = this.yaftService.getFeatureStatus(feature);
      switch (status.status) {
        case 'active': active++; break;
        case 'inactive': inactive++; break;
        case 'scheduled': scheduled++; break;
      }
    });
    
    this.analyticsData.featureMetrics = {
      total,
      active,
      inactive,
      scheduled,
      percentages: {
        active: total > 0 ? Math.round((active / total) * 100) : 0,
        inactive: total > 0 ? Math.round((inactive / total) * 100) : 0,
        scheduled: total > 0 ? Math.round((scheduled / total) * 100) : 0
      }
    };
    
    // Tag analytics (removed - not supported by YaFT library)
    this.analyticsData.tagAnalytics = [];
    
    // Activity metrics (simulated based on current data)
    const now = new Date();
    const _recentThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    this.analyticsData.activityMetrics = {
      recentCreated: Math.min(features.length, 5), // Simulate recent creation
      recentUpdated: Math.min(features.length, 3), // Simulate recent updates
      upcomingScheduled: features.filter(f => {
        const activeAt = f.activeAt ? new Date(f.activeAt) : null;
        const disabledAt = f.disabledAt ? new Date(f.disabledAt) : null;
        return (activeAt && activeAt > now) || (disabledAt && disabledAt > now);
      }).length,
      soonToExpire: features.filter(f => {
        const disabledAt = f.disabledAt ? new Date(f.disabledAt) : null;
        return disabledAt && disabledAt > now && disabledAt.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
      }).length
    };
    
    // Template usage
    const templateUsageCounts = templates.map(template => ({
      templateName: template.name,
      usage: template.usageCount || 0,
      percentage: 0
    }));
    
    const totalUsage = templateUsageCounts.reduce((sum, t) => sum + t.usage, 0);
    templateUsageCounts.forEach(t => {
      t.percentage = totalUsage > 0 ? Math.round((t.usage / totalUsage) * 100) : 0;
    });
    
    this.analyticsData.templateUsage = templateUsageCounts
      .filter(t => t.usage > 0)
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 8);
  }

  onTimeRangeChange(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.loadAnalyticsData();
  }

  getPieSegment(percentage: number): number {
    return (percentage / 100) * 251.2; // 2 * π * 40 (circumference)
  }

  getInsights(): Insight[] {
    const insights = [];
    
    if (this.analyticsData.featureMetrics.active > this.analyticsData.featureMetrics.inactive) {
      insights.push({
        type: 'success',
        icon: 'trending_up',
        title: 'Good Feature Activation',
        description: 'You have more active features than inactive ones, showing good feature utilization.',
        actionLabel: null
      });
    }
    
    if (this.analyticsData.activityMetrics.soonToExpire > 0) {
      insights.push({
        type: 'warning',
        icon: 'warning',
        title: 'Features Expiring Soon',
        description: `${this.analyticsData.activityMetrics.soonToExpire} features are scheduled to be disabled within 7 days.`,
        actionLabel: 'Review'
      });
    }
    
    if (this.analyticsData.tagAnalytics.length === 0) {
      insights.push({
        type: 'info',
        icon: 'label_off',
        title: 'No Tags in Use',
        description: 'Consider adding tags to your features to improve organization and filtering.',
        actionLabel: 'Learn More'
      });
    }
    
    return insights;
  }
}