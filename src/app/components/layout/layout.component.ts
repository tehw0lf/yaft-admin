import { Component, OnInit } from '@angular/core';

import { RouterModule } from '@angular/router';

// Angular Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule
],
  template: `
    <div class="layout-container">
      <mat-toolbar color="primary" class="main-toolbar">
        <button mat-icon-button (click)="sidenav.toggle()" class="menu-button">
          <mat-icon>menu</mat-icon>
        </button>
        
        <div class="toolbar-title">
          <mat-icon class="app-icon">toggle_on</mat-icon>
          <span>YaFT Admin</span>
        </div>
        
        <div class="toolbar-spacer"></div>
        
        <div class="toolbar-actions">
          <button mat-icon-button [matMenuTriggerFor]="settingsMenu" matTooltip="Settings">
            <mat-icon>settings</mat-icon>
          </button>
          <mat-menu #settingsMenu="matMenu">
            <button mat-menu-item (click)="toggleTheme()">
              <mat-icon>{{currentTheme === 'dark' ? 'light_mode' : 'dark_mode'}}</mat-icon>
              <span>{{currentTheme === 'dark' ? 'Light' : 'Dark'}} Mode</span>
            </button>
            <button mat-menu-item>
              <mat-icon>help</mat-icon>
              <span>Help</span>
            </button>
          </mat-menu>
        </div>
      </mat-toolbar>

      <mat-sidenav-container class="sidenav-container">
        <mat-sidenav #sidenav mode="side" opened class="sidenav">
          <mat-nav-list>
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>
            
            <a mat-list-item routerLink="/features" routerLinkActive="active">
              <mat-icon matListItemIcon>toggle_on</mat-icon>
              <span matListItemTitle>Features</span>
            </a>
            
            <a mat-list-item routerLink="/templates" routerLinkActive="active">
              <mat-icon matListItemIcon>description</mat-icon>
              <span matListItemTitle>Templates</span>
            </a>
            
            <a mat-list-item routerLink="/analytics" routerLinkActive="active">
              <mat-icon matListItemIcon>analytics</mat-icon>
              <span matListItemTitle>Analytics</span>
            </a>
            
            <mat-divider></mat-divider>
            
            <div class="nav-section-header">
              <span>Quick Actions</span>
            </div>
            
            <a mat-list-item tabindex="0" (click)="onExportAll()" (keyup.enter)="onExportAll()" (keyup.space)="onExportAll()">
              <mat-icon matListItemIcon>download</mat-icon>
              <span matListItemTitle>Export All</span>
            </a>

            <a mat-list-item tabindex="0" (click)="onImport()" (keyup.enter)="onImport()" (keyup.space)="onImport()">
              <mat-icon matListItemIcon>upload</mat-icon>
              <span matListItemTitle>Import</span>
            </a>
            
            <mat-divider></mat-divider>
            
            <div class="nav-footer">
              <div class="version-info">
                <small>YaFT Admin v1.0</small>
              </div>
            </div>
          </mat-nav-list>
        </mat-sidenav>
        
        <mat-sidenav-content class="main-content">
          <router-outlet></router-outlet>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    .layout-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .main-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      
      .menu-button {
        @media (min-width: 1024px) {
          display: none;
        }
      }
      
      .toolbar-title {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 20px;
        font-weight: 500;
        
        .app-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
        }
      }
      
      .toolbar-spacer {
        flex: 1;
      }
      
      .toolbar-actions {
        display: flex;
        gap: 8px;
      }
    }

    .sidenav-container {
      flex: 1;
    }

    .sidenav {
      width: 280px;
      border-right: 1px solid #e0e0e0;
      
      @media (max-width: 1023px) {
        position: fixed;
        z-index: 999;
      }
      
      .mat-nav-list {
        padding-top: 16px;
        
        .mat-list-item {
          border-radius: 8px;
          margin: 4px 16px;
          
          &.active {
            background-color: rgba(103, 58, 183, 0.1);
            color: #673ab7;
            
            .mat-icon {
              color: #673ab7;
            }
          }
          
          &:hover:not(.active) {
            background-color: rgba(0, 0, 0, 0.04);
          }
          
          .mat-icon {
            margin-right: 16px;
          }
        }
      }
      
      .nav-section-header {
        padding: 16px 24px 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: #666;
        letter-spacing: 1px;
      }
      
      .nav-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 16px 24px;
        border-top: 1px solid #e0e0e0;
        
        .version-info {
          text-align: center;
          color: #999;
          
          small {
            font-size: 11px;
          }
        }
      }
    }

    .main-content {
      background-color: #f5f5f5;
      min-height: calc(100vh - 64px);
      
      ::ng-deep {
        router-outlet + * {
          display: block;
          width: 100%;
        }
      }
    }

    /* Dark mode styles */
    :host-context(.dark-theme) {
      .sidenav {
        background-color: #2d2d2d;
        border-right-color: #404040;
        color: white;
        
        .mat-list-item {
          &.active {
            background-color: rgba(156, 39, 176, 0.2);
            color: #e1bee7;
            
            .mat-icon {
              color: #e1bee7;
            }
          }
          
          &:hover:not(.active) {
            background-color: rgba(255, 255, 255, 0.08);
          }
        }
        
        .nav-section-header {
          color: #bbb;
        }
        
        .nav-footer {
          border-top-color: #404040;
          
          .version-info {
            color: #666;
          }
        }
      }
      
      .main-content {
        background-color: #1a1a1a;
      }
    }
  `]
})
export class LayoutComponent implements OnInit {
  currentTheme: 'light' | 'dark' = 'light';

  ngOnInit(): void {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('yaft-admin-theme') as 'light' | 'dark';
    if (savedTheme) {
      this.currentTheme = savedTheme;
      this.applyTheme();
    }
  }

  toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme();
    localStorage.setItem('yaft-admin-theme', this.currentTheme);
  }

  private applyTheme(): void {
    const body = document.body;
    if (this.currentTheme === 'dark') {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
  }

  onExportAll(): void {
    // To be connected to export functionality
    console.log('Export all features');
  }

  onImport(): void {
    // To be connected to import functionality
    console.log('Import features');
  }
}