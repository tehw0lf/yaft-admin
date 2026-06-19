import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Feature, FeatureWithSecret } from '../../models/feature.model';

export interface ImportPreviewDialogData {
  features: Feature[];
  warnings: string[];
  existingFeatures: FeatureWithSecret[];
}

@Component({
  selector: 'app-import-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>upload_file</mat-icon>
      Import Preview
    </h2>

    <mat-dialog-content>
      @if (data.warnings.length > 0) {
        <div class="warnings-section">
          <div class="warnings-header">
            <mat-icon class="warning-icon">warning</mat-icon>
            <span>Warnings ({{ data.warnings.length }})</span>
          </div>
          <ul class="warnings-list">
            @for (warning of data.warnings; track warning) {
              <li>{{ warning }}</li>
            }
          </ul>
        </div>
      }

      <p class="import-summary">
        Importing <strong>{{ data.features.length }}</strong> feature(s).
        @if (conflictCount > 0) {
          <span class="conflict-note">
            <mat-icon class="inline-icon">warning_amber</mat-icon>
            {{ conflictCount }} conflict(s) with existing keys — these will be added as duplicates.
          </span>
        }
      </p>

      <table mat-table [dataSource]="data.features" class="features-table">
        <ng-container matColumnDef="conflict">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let feature">
            @if (isConflict(feature)) {
              <mat-icon class="conflict-icon"
                matTooltip="Key already exists in current provider">
                warning_amber
              </mat-icon>
            }
          </td>
        </ng-container>

        <ng-container matColumnDef="key">
          <th mat-header-cell *matHeaderCellDef>Key</th>
          <td mat-cell *matCellDef="let feature"
            [class.conflict-row]="isConflict(feature)">
            {{ feature.key }}
          </td>
        </ng-container>

        <ng-container matColumnDef="value">
          <th mat-header-cell *matHeaderCellDef>Value</th>
          <td mat-cell *matCellDef="let feature">{{ feature.value }}</td>
        </ng-container>

        <ng-container matColumnDef="activeAt">
          <th mat-header-cell *matHeaderCellDef>Active At</th>
          <td mat-cell *matCellDef="let feature">{{ feature.activeAt ?? '—' }}</td>
        </ng-container>

        <ng-container matColumnDef="disabledAt">
          <th mat-header-cell *matHeaderCellDef>Disabled At</th>
          <td mat-cell *matCellDef="let feature">{{ feature.disabledAt ?? '—' }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"
          [class.conflict-row]="isConflict(row)"></tr>
      </table>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-flat-button color="primary" (click)="confirm()">
        <mat-icon>check</mat-icon>
        Import
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .warnings-section {
      background: rgba(255, 152, 0, 0.12);
      border-left: 4px solid #ff9800;
      border-radius: 4px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }

    .warnings-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .warning-icon {
      color: #ff9800;
    }

    .warnings-list {
      margin: 0;
      padding-left: 20px;

      li {
        font-size: 0.875rem;
        margin-bottom: 4px;
      }
    }

    .import-summary {
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .conflict-note {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #ff9800;
      font-size: 0.875rem;
    }

    .inline-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .features-table {
      width: 100%;
    }

    .conflict-icon {
      color: #ff9800;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    tr.conflict-row td {
      background: rgba(255, 152, 0, 0.08);
    }

    mat-dialog-content {
      max-height: 60vh;
      min-width: 560px;
    }
  `]
})
export class ImportPreviewDialogComponent {
  readonly data = inject<ImportPreviewDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ImportPreviewDialogComponent>);

  readonly displayedColumns = ['conflict', 'key', 'value', 'activeAt', 'disabledAt'];

  private existingKeys = new Set(this.data.existingFeatures.map(f => f.key));

  get conflictCount(): number {
    return this.data.features.filter(f => this.isConflict(f)).length;
  }

  isConflict(feature: Feature): boolean {
    return this.existingKeys.has(feature.key);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
