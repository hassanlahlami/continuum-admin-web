import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssignmentInput, AssignmentsService } from '../../../libs/api-clients/admin-iam';

/**
 * Page « Affecter une position » (ADM, §2.1.3) : l'administrateur octroie une position à un
 * utilisateur sur une unité. Appelle `POST /api/admin/assignments` via le client **généré** (D32) ;
 * le backend applique anti-auto-octroi, SoD statique (409) et validations (422). Le front n'enforce
 * aucune règle : il affiche la décision du serveur.
 */
@Component({
  selector: 'ct-assign-position',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section>
      <h1>Affecter une position</h1>
      <form class="form" (submit)="$event.preventDefault(); submit()">
        <label>Utilisateur (UUID)
          <input name="userId" [(ngModel)]="userId" required /></label>
        <label>Position (UUID)
          <input name="positionId" [(ngModel)]="positionId" required /></label>
        <label>Unité (UUID)
          <input name="unitId" [(ngModel)]="unitId" /></label>
        <label>Type
          <select name="kind" [(ngModel)]="kind">
            <option value="HOLDER">Titulaire</option>
            <option value="INTERIM">Intérim</option>
            <option value="DELEGATION">Délégation</option>
          </select></label>
        <button type="submit" [disabled]="busy()">Affecter</button>
      </form>

      @if (ok(); as o) {
        <p class="ok" role="status">✓ Affectation créée — id {{ o.id }} (état {{ o.state }}).</p>
      }
      @if (error(); as e) {
        <p class="err" role="alert">✗ Refus (HTTP {{ e.status }}) : {{ e.message }}</p>
      }
    </section>
  `,
  styles: [`
    .form { display: grid; gap: var(--ct-space-3); max-width: 480px; }
    .form label { display: grid; gap: var(--ct-space-1); font-size: 0.85rem; color: var(--ct-color-muted); }
    .form input, .form select { padding: 9px 12px; font: inherit; border: 1px solid var(--ct-color-border); border-radius: var(--ct-button-radius); background: var(--ct-color-surface); color: var(--ct-color-text); }
    .ok { color: var(--ct-green-600); font-weight: 600; }
    .err { color: var(--ct-color-danger-text, #a1281c); font-weight: 600; }
  `],
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
