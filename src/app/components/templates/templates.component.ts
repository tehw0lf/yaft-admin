import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { TemplateService } from '../../services/template.service';
import { YaftProviderService } from '../../services/yaft-provider.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { 
  FeatureTemplate, 
  TemplateCategory, 
  TemplateVariable, 
  TemplateUsage 
} from '../../models/template.model';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatExpansionModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="templates-container">
      <div class="templates-header">
        <h2>
          <mat-icon>library_books</mat-icon>
          Feature Templates
        </h2>
        <p class="templates-subtitle">Create features quickly using pre-defined templates</p>
        
        <div class="header-actions">
          <input type="file" #fileInput (change)="onImportTemplates($event)" 
                 accept=".json" style="display: none;">
          <button mat-button (click)="fileInput.click()">
            <mat-icon>upload</mat-icon>
            Import
          </button>
          <button mat-button (click)="onExportTemplates()">
            <mat-icon>download</mat-icon>
            Export
          </button>
          <button mat-raised-button color="primary" (click)="openCreateTemplateDialog()">
            <mat-icon>add</mat-icon>
            Create Template
          </button>
        </div>
      </div>

      <mat-tab-group class="templates-tabs" [dynamicHeight]="true">
        <!-- Browse Templates Tab -->
        <mat-tab label="Browse Templates">
          <div class="tab-content">
            <!-- Quick Access - Most Used -->
            <mat-card class="quick-access-card" *ngIf="mostUsedTemplates.length > 0">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>star</mat-icon>
                  Most Used Templates
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="template-grid">
                  <div *ngFor="let template of mostUsedTemplates" 
                       class="template-card quick-template"
                       (click)="useTemplate(template)">
                    <div class="template-icon">
                      <mat-icon>{{template.icon}}</mat-icon>
                    </div>
                    <div class="template-info">
                      <h4>{{template.name}}</h4>
                      <p>{{template.description}}</p>
                      <div class="template-stats">
                        <span class="usage-count">{{template.usageCount}} uses</span>
                      </div>
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Templates by Category -->
            <div *ngFor="let category of categories" class="category-section">
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon>{{category.icon}}</mat-icon>
                    {{category.name}}
                  </mat-panel-title>
                  <mat-panel-description>
                    {{category.description}} ({{category.templates.length}} templates)
                  </mat-panel-description>
                </mat-expansion-panel-header>
                
                <div class="template-grid">
                  <mat-card *ngFor="let template of category.templates" 
                           class="template-card"
                           [class.built-in]="template.isBuiltIn">
                    <mat-card-header>
                      <mat-card-title>
                        <mat-icon>{{template.icon}}</mat-icon>
                        {{template.name}}
                      </mat-card-title>
                      <div class="template-actions">
                        <button mat-icon-button [matMenuTriggerFor]="templateMenu">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #templateMenu="matMenu">
                          <button mat-menu-item (click)="useTemplate(template)">
                            <mat-icon>play_arrow</mat-icon>
                            Use Template
                          </button>
                          <button mat-menu-item (click)="duplicateTemplate(template)">
                            <mat-icon>content_copy</mat-icon>
                            Duplicate
                          </button>
                          <button mat-menu-item *ngIf="!template.isBuiltIn" 
                                  (click)="editTemplate(template)">
                            <mat-icon>edit</mat-icon>
                            Edit
                          </button>
                          <button mat-menu-item *ngIf="!template.isBuiltIn" 
                                  (click)="deleteTemplate(template)">
                            <mat-icon>delete</mat-icon>
                            Delete
                          </button>
                        </mat-menu>
                      </div>
                    </mat-card-header>
                    <mat-card-content>
                      <p class="template-description">{{template.description}}</p>
                      <div class="template-preview">
                        <strong>Key Pattern:</strong> <code>{{template.keyTemplate}}</code>
                      </div>
                      <div class="template-tags">
                        <mat-chip-set>
                          <mat-chip *ngFor="let tag of template.tags">{{tag}}</mat-chip>
                        </mat-chip-set>
                      </div>
                      <div class="template-footer">
                        <span class="usage-count">{{template.usageCount}} uses</span>
                        <span class="template-type" *ngIf="template.isBuiltIn">Built-in</span>
                      </div>
                    </mat-card-content>
                    <mat-card-actions>
                      <button mat-raised-button color="primary" (click)="useTemplate(template)">
                        <mat-icon>play_arrow</mat-icon>
                        Use Template
                      </button>
                    </mat-card-actions>
                  </mat-card>
                </div>
              </mat-expansion-panel>
            </div>
          </div>
        </mat-tab>

        <!-- Recent Usage Tab -->
        <mat-tab label="Recent Usage">
          <div class="tab-content">
            <mat-card class="recent-usage-card">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>history</mat-icon>
                  Recent Template Usage
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div *ngIf="recentUsage.length === 0" class="empty-state">
                  <mat-icon>info</mat-icon>
                  <p>No recent template usage</p>
                  <p>Start using templates to see your history here</p>
                </div>
                
                <div *ngFor="let usage of recentUsage" class="usage-item">
                  <div class="usage-info">
                    <div class="usage-feature">
                      <strong>{{usage.featureKey}}</strong>
                      <span class="usage-template">from "{{getTemplateName(usage.templateId)}}"</span>
                    </div>
                    <div class="usage-date">
                      {{usage.createdAt | date:'short'}}
                    </div>
                  </div>
                  <div class="usage-actions">
                    <button mat-icon-button 
                            matTooltip="Use this template again"
                            (click)="reuseTemplate(usage.templateId)">
                      <mat-icon>refresh</mat-icon>
                    </button>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Create Template Tab -->
        <mat-tab label="Create Template">
          <div class="tab-content">
            <mat-card class="create-template-card">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>add_box</mat-icon>
                  Create Custom Template
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <form [formGroup]="createTemplateForm" (ngSubmit)="onCreateTemplate()">
                  <div class="form-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Template Name</mat-label>
                      <input matInput formControlName="name" placeholder="My Custom Template">
                      <mat-error *ngIf="createTemplateForm.get('name')?.hasError('required')">
                        Name is required
                      </mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Category</mat-label>
                      <mat-select formControlName="category">
                        <mat-option *ngFor="let cat of categories" [value]="cat.name">
                          {{cat.name}}
                        </mat-option>
                        <mat-option value="Custom">Custom</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Description</mat-label>
                    <textarea matInput formControlName="description" rows="2"
                              placeholder="Describe what this template is for..."></textarea>
                  </mat-form-field>

                  <div class="form-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Key Template</mat-label>
                      <input matInput formControlName="keyTemplate" 
                             placeholder="{{'{{'}}feature_name{{'}}'}}_{{'{{'}}version{{'}}'}}">
                      <mat-hint>Use {{'{{'}}variable_name{{'}}'}} for dynamic values</mat-hint>
                      <mat-error *ngIf="createTemplateForm.get('keyTemplate')?.hasError('required')">
                        Key template is required
                      </mat-error>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Default Value</mat-label>
                      <mat-select formControlName="value">
                        <mat-option value="true">Enabled</mat-option>
                        <mat-option value="false">Disabled</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Tags (comma-separated)</mat-label>
                    <input matInput formControlName="tagsInput" 
                           placeholder="tag1, tag2, tag3">
                  </mat-form-field>

                  <div class="form-actions">
                    <button mat-raised-button color="primary" type="submit" 
                            [disabled]="createTemplateForm.invalid">
                      <mat-icon>save</mat-icon>
                      Create Template
                    </button>
                    <button mat-button type="button" (click)="resetCreateForm()">
                      Reset
                    </button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .templates-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .templates-header {
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
      
      .templates-subtitle {
        color: #666;
        margin: 0 0 24px 0;
        font-size: 16px;
      }
      
      .header-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      }
    }

    .templates-tabs {
      .mat-tab-body-content {
        padding: 24px 0;
      }
    }

    .tab-content {
      min-height: 400px;
    }

    .quick-access-card {
      margin-bottom: 24px;
      
      .template-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }
      
      .quick-template {
        padding: 16px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 16px;
        
        &:hover {
          background-color: #f5f5f5;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .template-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 24px;
          background: linear-gradient(135deg, #673ab7, #9c27b0);
          color: white;
          
          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }
        
        .template-info {
          flex: 1;
          
          h4 {
            margin: 0 0 4px 0;
            font-size: 16px;
            font-weight: 500;
          }
          
          p {
            margin: 0 0 8px 0;
            color: #666;
            font-size: 14px;
          }
          
          .template-stats {
            .usage-count {
              font-size: 12px;
              color: #999;
              background: #f0f0f0;
              padding: 2px 6px;
              border-radius: 4px;
            }
          }
        }
      }
    }

    .category-section {
      margin-bottom: 16px;
      
      .mat-expansion-panel-header {
        .mat-panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
      
      .template-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
    }

    .template-card {
      transition: transform 0.2s ease;
      
      &:hover {
        transform: translateY(-2px);
      }
      
      &.built-in {
        border-left: 4px solid #4caf50;
      }
      
      .mat-card-header {
        .mat-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          
          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #673ab7;
          }
        }
        
        .template-actions {
          margin-left: auto;
        }
      }
      
      .template-description {
        color: #666;
        margin: 0 0 12px 0;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .template-preview {
        background: #f5f5f5;
        padding: 8px 12px;
        border-radius: 4px;
        margin-bottom: 12px;
        font-size: 13px;
        
        code {
          font-family: 'Courier New', monospace;
          color: #d32f2f;
          font-weight: bold;
        }
      }
      
      .template-tags {
        margin-bottom: 12px;
        
        mat-chip-set {
          margin: 0;
        }
        
        mat-chip {
          font-size: 11px;
          height: 20px;
        }
      }
      
      .template-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #eee;
        
        .usage-count {
          font-size: 12px;
          color: #666;
        }
        
        .template-type {
          font-size: 11px;
          background: #4caf50;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
        }
      }
    }

    .recent-usage-card {
      .usage-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
        
        &:last-child {
          border-bottom: none;
        }
        
        .usage-info {
          flex: 1;
          
          .usage-feature {
            margin-bottom: 4px;
            
            strong {
              font-size: 14px;
            }
            
            .usage-template {
              font-size: 12px;
              color: #666;
              margin-left: 8px;
            }
          }
          
          .usage-date {
            font-size: 12px;
            color: #999;
          }
        }
      }
    }

    .create-template-card {
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        
        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }
      }
      
      .form-actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
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
        margin: 8px 0;
        
        &:first-of-type {
          font-weight: 500;
          font-size: 16px;
        }
      }
    }

    .full-width {
      width: 100%;
    }
  `]
})
export class TemplatesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  categories: TemplateCategory[] = [];
  mostUsedTemplates: FeatureTemplate[] = [];
  recentUsage: TemplateUsage[] = [];
  
  createTemplateForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private templateService: TemplateService,
    private yaftService: YaftProviderService,
    private errorHandler: ErrorHandlerService,
    private dialog: MatDialog
  ) {
    this.createTemplateForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      description: [''],
      category: ['Custom'],
      keyTemplate: ['', Validators.required],
      value: ['false'],
      tagsInput: ['']
    });
  }

  private loadData(): void {
    this.categories = this.templateService.getCategories();
    this.mostUsedTemplates = this.templateService.getMostUsedTemplates(6);
    this.recentUsage = this.templateService.getRecentUsage(10);
  }

  useTemplate(template: FeatureTemplate): void {
    // Open dialog for template variable input
    console.log('Use template:', template);
    // Implementation for template usage dialog would go here
  }

  duplicateTemplate(template: FeatureTemplate): void {
    const duplicate = {
      ...template,
      name: `${template.name} (Copy)`,
      isBuiltIn: false
    };
    delete (duplicate as any).id;
    delete (duplicate as any).createdAt;
    delete (duplicate as any).usageCount;
    
    this.templateService.createTemplate(duplicate)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadData();
      });
  }

  editTemplate(template: FeatureTemplate): void {
    console.log('Edit template:', template);
    // Implementation for edit dialog would go here
  }

  deleteTemplate(template: FeatureTemplate): void {
    const confirmed = confirm(`Are you sure you want to delete the template "${template.name}"?`);
    if (confirmed) {
      this.templateService.deleteTemplate(template.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadData();
        });
    }
  }

  onCreateTemplate(): void {
    if (this.createTemplateForm.invalid) return;
    
    const formValue = this.createTemplateForm.value;
    const tags = formValue.tagsInput 
      ? formValue.tagsInput.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag)
      : [];

    const template = {
      name: formValue.name,
      description: formValue.description,
      category: formValue.category,
      keyTemplate: formValue.keyTemplate,
      value: formValue.value,
      tags,
      icon: 'label' // Default icon
    };

    this.templateService.createTemplate(template)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadData();
        this.resetCreateForm();
      });
  }

  resetCreateForm(): void {
    this.createTemplateForm.reset({
      value: 'false',
      category: 'Custom'
    });
  }

  onExportTemplates(): void {
    this.templateService.exportTemplates();
  }

  onImportTemplates(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      this.templateService.importTemplates(file)
        .then(() => {
          this.loadData();
        })
        .catch(error => {
          console.error('Import failed:', error);
        });
      
      // Clear the input
      input.value = '';
    }
  }

  getTemplateName(templateId: string): string {
    const template = this.templateService.getTemplate(templateId);
    return template ? template.name : 'Unknown Template';
  }

  reuseTemplate(templateId: string): void {
    const template = this.templateService.getTemplate(templateId);
    if (template) {
      this.useTemplate(template);
    }
  }

  openCreateTemplateDialog(): void {
    // For now, just switch to the create template tab
    // In a full implementation, this could open a dialog
    console.log('Open create template dialog');
  }
}