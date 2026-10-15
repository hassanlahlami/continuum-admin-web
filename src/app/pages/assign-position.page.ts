import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AssignmentInput, AssignmentsService } from '../../../libs/api-clients/admin-iam';

/**
 * Page « Affecter une position » (ADM, §2.1.3) : l'administrateur octroie une position à un
 * utilisateur sur une unité. Appelle `POST /api/admin/assignments` via le client **généré** (D32) ;
 * le backend applique anti-auto-octroi, SoD statique (409) et validations (422). Le front n'enforce
 * aucune règle : il affiche la décision du serveur. Composants Material habillés par les tokens --ct-*.
 */
@Component({
  selector: 'ct-assign-position',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <section>
      <h1>Affecter une position</h1>
      <mat-card appearance="outlined">
        <mat-card-content>
          <form class="form" (submit)="$event.preventDefault(); submit()">
            <mat-form-field appearance="outline">
              <mat-label>Utilisateur (UUID)</mat-label>
              <input matInput name="userId" data-cy="assign-user" [(ngModel)]="userId" required />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Position (UUID)</mat-label>
              <input matInput name="positionId" data-cy="assign-position" [(ngModel)]="positionId" required />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Unité (UUID)</mat-label>
              <input matInput name="unitId" data-cy="assign-unit" [(ngModel)]="unitId" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select name="kind" data-cy="assign-kind" [(ngModel)]="kind">
                <mat-option value="HOLDER">Titulaire</mat-option>
                <mat-option value="INTERIM">Intérim</mat-option>
                <mat-option value="DELEGATION">Délégation</mat-option>
              </mat-select>
            </mat-form-field>
            <div class="actions">
              <button mat-flat-button color="primary" type="submit" data-cy="assign-submit" [disabled]="busy()">Affecter</button>
            </div>
          </form>

          @if (ok(); as o) {
            <p class="ok" role="status" data-cy="assign-ok">✓ Affectation créée — id {{ o.id }} (état {{ o.state }}).</p>
          }
          @if (error(); as e) {
            <p class="err" role="alert" data-cy="assign-error">✗ Refus (HTTP {{ e.status }}) : {{ e.message }}</p>
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .form { display: grid; gap: var(--ct-space-2); max-width: 480px; }
      .actions { margin-top: var(--ct-space-2); }
      .ok { color: var(--ct-green-600); font-weight: 600; }
      .err { color: var(--ct-red-700); font-weight: 600; }
    `,
  ],
})
export class AssignPositionPage {
  private readonly assignments = inject(AssignmentsService);

  readonly userId = signal('22222222-2222-2222-2222-222222222222');
  readonly positionId = signal('d2222222-2222-2222-2222-222222222222');
  readonly unitId = signal('b1111111-1111-1111-1111-111111111111');
  readonly kind = signal<AssignmentInput.KindEnum>('HOLDER');
  readonly busy = signal(false);
  readonly ok = signal<{ id?: string; state?: string } | null>(null);
  readonly error = signal<{ status: number; message: string } | null>(null);

  submit(): void {
    this.ok.set(null);
    this.error.set(null);
    this.busy.set(true);
    const input: AssignmentInput = {
      userId: this.userId(),
      positionId: this.positionId(),
      unitId: this.unitId() || undefined,
      kind: this.kind(),
      validFrom: new Date().toISOString().slice(0, 10),
    };
    this.assignments.createAssignment(input).subscribe({
      next: (a) => {
        this.ok.set({ id: a.id, state: a.state });
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => {
        const detail = (e.error && (e.error.detail || e.error.title)) || e.message;
        this.error.set({ status: e.status, message: detail });
        this.busy.set(false);
      },
    });
  }
}
