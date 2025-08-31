import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { Feature, FeatureFilter } from '../models/feature.model';
import { YaftProviderService } from './yaft-provider.service';

@Injectable({
  providedIn: 'root'
})
export class FilterService {
  private filterSubject = new BehaviorSubject<FeatureFilter>({
    searchText: '',
    status: [],
    dateRange: {
      start: null,
      end: null
    }
  });

  public filter$ = this.filterSubject.asObservable();
  public filteredFeatures$: Observable<Feature[]>;

  constructor(private yaftService: YaftProviderService) {
    // Combine features and filter to create filtered results
    this.filteredFeatures$ = combineLatest([
      this.yaftService.features$,
      this.filter$
    ]).pipe(
      map(([features, filter]) => this.applyFilter(features, filter))
    );
  }

  updateFilter(filter: Partial<FeatureFilter>): void {
    const currentFilter = this.filterSubject.value;
    this.filterSubject.next({
      ...currentFilter,
      ...filter
    });
  }

  clearFilter(): void {
    this.filterSubject.next({
      searchText: '',
      status: [],
      dateRange: {
        start: null,
        end: null
      }
    });
  }

  getCurrentFilter(): FeatureFilter {
    return this.filterSubject.value;
  }

  private applyFilter(features: Feature[], filter: FeatureFilter): Feature[] {
    return features.filter(feature => {
      // Text search filter
      if (filter.searchText) {
        const searchText = filter.searchText.toLowerCase();
        const matchesKey = feature.key.toLowerCase().includes(searchText);
        
        if (!matchesKey) {
          return false;
        }
      }

      // Status filter
      if (filter.status.length > 0) {
        const featureStatus = this.yaftService.getFeatureStatus(feature);
        if (!filter.status.includes(featureStatus.status)) {
          return false;
        }
      }


      // Date range filter
      if (filter.dateRange.start || filter.dateRange.end) {
        const activeDate = feature.activeAt ? new Date(feature.activeAt) : null;
        const disabledDate = feature.disabledAt ? new Date(feature.disabledAt) : null;
        
        // Check if feature falls within date range
        let withinRange = false;
        
        if (activeDate) {
          withinRange = this.isDateInRange(activeDate, filter.dateRange);
        }
        
        if (!withinRange && disabledDate) {
          withinRange = this.isDateInRange(disabledDate, filter.dateRange);
        }
        
        if (!withinRange) {
          return false;
        }
      }

      return true;
    });
  }

  private isDateInRange(date: Date, range: { start: Date | null; end: Date | null }): boolean {
    if (range.start && date < range.start) {
      return false;
    }
    if (range.end && date > range.end) {
      return false;
    }
    return true;
  }

}