import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { Subject, takeUntil, debounceTime } from 'rxjs';

// Angular Material Imports
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';

import { FilterService } from '../../services/filter.service';
import { YaftProviderService } from '../../services/yaft-provider.service';
import { Feature, FeatureFilter } from '../../models/feature.model';

@Component({
  selector: 'app-feature-filters',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCardModule
],
  template: `
    <mat-card class="filter-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>filter_list</mat-icon>
          Filters & Search
        </mat-card-title>
        <div class="header-actions">
          <button mat-icon-button (click)="clearFilters()"
            [disabled]="!hasActiveFilters()"
            matTooltip="Clear all filters">
            <mat-icon>clear</mat-icon>
          </button>
        </div>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="filterForm" class="filter-form">
          <div class="filter-row">
            <!-- Search Input -->
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search Features</mat-label>
              <input matInput formControlName="searchText"
                placeholder="Search by key...">
              <mat-icon matPrefix>search</mat-icon>
              @if (filterForm.get('searchText')?.value) {
                <button mat-icon-button matSuffix
                  (click)="clearSearch()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>
    
            <!-- Status Filter -->
            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status" multiple>
                <mat-option value="active">Active</mat-option>
                <mat-option value="inactive">Inactive</mat-option>
                <mat-option value="scheduled">Scheduled</mat-option>
              </mat-select>
              <mat-hint>Filter by feature status</mat-hint>
            </mat-form-field>
          </div>
    
          <!-- Tags Filter Row -->
          <div class="filter-row tags-filter-row">
            <mat-form-field appearance="outline" class="tags-filter-field">
              <mat-label>Filter by Tags</mat-label>
              <mat-select formControlName="tags" multiple>
                @for (tag of availableTags; track tag) {
                  <mat-option [value]="tag">
                    {{tag}}
                  </mat-option>
                }
              </mat-select>
              <mat-hint>Select tags to filter features</mat-hint>
            </mat-form-field>
          </div>
    
          <div class="filter-row">
            <!-- Date Range -->
            <div class="date-range-container">
              <mat-form-field appearance="outline">
                <mat-label>Start Date</mat-label>
                <input matInput [matDatepicker]="startPicker"
                  formControlName="dateStart">
                <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
                <mat-datepicker #startPicker></mat-datepicker>
              </mat-form-field>
    
              <mat-form-field appearance="outline">
                <mat-label>End Date</mat-label>
                <input matInput [matDatepicker]="endPicker"
                  formControlName="dateEnd">
                <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
                <mat-datepicker #endPicker></mat-datepicker>
              </mat-form-field>
            </div>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .filter-card {
      margin-bottom: 16px;
    }

    .filter-card .mat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      
      .mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .header-actions {
        display: flex;
        gap: 8px;
      }
    }

    .filter-form {
      .filter-row {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }
      }
      
      .search-field {
        width: 100%;
      }
      
      .date-range-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        
        @media (max-width: 576px) {
          grid-template-columns: 1fr;
        }
      }
    }
  `]
})
export class FeatureFiltersComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private filterService = inject(FilterService);
  private yaftService = inject(YaftProviderService);

  private destroy$ = new Subject<void>();
  
  filterForm: FormGroup;
  availableTags: string[] = [];

  constructor() {
    this.filterForm = this.createFilterForm();
  }

  ngOnInit(): void {
    // Subscribe to form changes with debounce
    this.filterForm.valueChanges
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(formValue => {
        this.updateFilters(formValue);
      });


    // Initialize form with current filter values
    this.filterService.filter$
      .pipe(takeUntil(this.destroy$))
      .subscribe(filter => {
        this.filterForm.patchValue({
          searchText: filter.searchText,
          status: filter.status,
          tags: filter.tags,
          dateStart: filter.dateRange.start,
          dateEnd: filter.dateRange.end
        }, { emitEvent: false });
      });

    // Subscribe to features to extract available tags
    this.yaftService.features$
      .pipe(takeUntil(this.destroy$))
      .subscribe(features => {
        this.updateAvailableTags(features);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createFilterForm(): FormGroup {
    return this.fb.group({
      searchText: [''],
      status: [[]],
      tags: [[]],
      dateStart: [null],
      dateEnd: [null]
    });
  }

  private updateFilters(formValue: { searchText?: string; status?: string[]; tags?: string[]; dateStart?: Date | null; dateEnd?: Date | null }): void {
    const filter: FeatureFilter = {
      searchText: formValue.searchText || '',
      status: formValue.status || [],
      tags: formValue.tags || [],
      dateRange: {
        start: formValue.dateStart,
        end: formValue.dateEnd
      }
    };

    this.filterService.updateFilter(filter);
  }

  clearFilters(): void {
    this.filterService.clearFilter();
  }

  clearSearch(): void {
    this.filterForm.patchValue({ searchText: '' });
  }

  hasActiveFilters(): boolean {
    const filter = this.filterService.getCurrentFilter();
    return !!(
      filter.searchText ||
      filter.status.length > 0 ||
      filter.tags.length > 0 ||
      filter.dateRange.start ||
      filter.dateRange.end
    );
  }

  private updateAvailableTags(features: Feature[]): void {
    const tagSet = new Set<string>();
    
    features.forEach(feature => {
      if (feature.tags && Array.isArray(feature.tags)) {
        feature.tags.forEach((tag: string) => tagSet.add(tag));
      }
    });
    
    this.availableTags = Array.from(tagSet).sort();
  }
}