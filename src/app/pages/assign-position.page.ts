import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import {
  Assignment,
  AssignmentInput,
  AssignmentsService,
  OrgService,
  OrgUnitNode,
  Position,
  PositionsService,
  UserAccount,
  UsersService,
} from '../../../libs/api-clients/admin-iam';
import { ASSIGNMENT_KIND_LABELS, ASSIGNMENT_STATE_LABELS } from '../iam.labels';

interface UnitOption {
  id: string;
  label: string;
  depth: number;
}

/**
 * Affecter une position (ADM, §2.1.3) : l'administrateur octroie une position à un utilisateur sur une
 * unité, via des <strong>sélecteurs par libellé</strong> (utilisateur, position, unité) alimentés par le
 * contrat (`listUsers`, `listPositions`, `getOrgTree`) — plus d'UUID à saisir. `POST /assignments` via le
 * client généré (D32) ; le serveur applique anti-auto-octroi, SoD statique (409), validations (422). Le
 * front n'enforce aucune règle : il affiche la décision. Aperçu des affectations existantes sous le formulaire.
 */
@Component({
  selector: 'ct-assign-position',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatProgressBarModule,
  ],
  template: `
    <section>
      <h1>Affecter une position</h1>
      <p class="page-sub">Octroyer une position à un utilisateur sur une unité. Le serveur applique les contrôles (anti-auto-octroi, séparation des tâches).</p>

      <mat-card appearance="outlined" class="block">
        <mat-card-content>
          <form class="form" (submit)="$event.preventDefault(); submit()">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Utilisateur</mat-label>
              <mat-select name="userId" data-cy="assign-user" [(ngModel)]="userId" required>
                @for (u of users(); track u.id) {
                  <mat-option [value]="u.id">{{ u.displayName }} <span class="opt-sub">· {{ u.username }}</span></mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Position</mat-label>
              <mat-select name="positionId" data-cy="assign-position" [(ngModel)]="positionId" required>
                @for (p of positions(); track p.id) {
                  <mat-option [value]="p.id">{{ p.label.fr }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Unité</mat-label>
              <mat-select name="unitId" data-cy="assign-unit" [(ngModel)]="unitId">
                <mat-option [value]="''">— Aucune —</mat-option>
                @for (u of units(); track u.id) {
                  <mat-option [value]="u.id"><span [style.padding-left.px]="u.depth * 14">{{ u.label }}</span></mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Type</mat-label>
              <mat-select name="kind" data-cy="assign-kind" [(ngModel)]="kind">
                <mat-option value="HOLDER">Titulaire</mat-option>
                <mat-option value="INTERIM">Intérim</mat-option>
                <mat-option value="DELEGATION">Délégation</mat-option>
              </mat-select>
            </mat-form-field>
            <div class="actions">
              <button mat-flat-button color="primary" type="submit" data-cy="assign-submit" [disabled]="busy() || !userId() || !positionId()">
                <mat-icon>badge</mat-icon> Affecter
              </button>
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

      <mat-card appearance="outlined" class="block">
        <mat-card-header><mat-card-title>Affectations existantes</mat-card-title></mat-card-header>
        @if (assignments().length) {
          <table mat-table [dataSource]="assignments()" data-cy="assign-existing">
            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef>Utilisateur</th>
              <td mat-cell *matCellDef="let a">{{ a.user?.displayName ?? a.userId }}</td>
            </ng-container>
            <ng-container matColumnDef="position">
              <th mat-header-cell *matHeaderCellDef>Position</th>
              <td mat-cell *matCellDef="let a">{{ a.positionLabel ?? a.positionId }}</td>
            </ng-container>
            <ng-container matColumnDef="unit">
              <th mat-header-cell *matHeaderCellDef>Unité</th>
              <td mat-cell *matCellDef="let a">{{ a.unit?.label ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="kind">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let a"><span class="muted">{{ kindLabel(a.kind) }}</span></td>
            </ng-container>
            <ng-container matColumnDef="validFrom">
              <th mat-header-cell *matHeaderCellDef>Depuis</th>
              <td mat-cell *matCellDef="let a">{{ a.validFrom | date: 'dd/MM/yyyy' }}</td>
            </ng-container>
            <ng-container matColumnDef="state">
              <th mat-header-cell *matHeaderCellDef>État</th>
              <td mat-cell *matCellDef="let a"><mat-chip-set><mat-chip disableRipple [attr.data-state]="a.state">{{ stateLabel(a.state) }}</mat-chip></mat-chip-set></td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: columns" data-cy="assign-row"></tr>
          </table>
        } @else {
          <mat-card-content><p data-cy="assign-existing-empty">Aucune affectation.</p></mat-card-content>
        }
      </mat-card>
    </section>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .block { margin-top: var(--ct-space-3); }
      .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--ct-space-3); align-items: start; max-width: 760px; }
      .actions { grid-column: 1 / -1; }
      .opt-sub { color: var(--ct-color-muted); }
      table[mat-table] { width: 100%; background: transparent; }
      .muted { color: var(--ct-color-muted); }
      .ok { color: var(--ct-green-600); font-weight: 600; margin-top: var(--ct-space-3); }
      .err { color: var(--ct-red-700); font-weight: 600; margin-top: var(--ct-space-3); }
      mat-chip[data-state='ACTIVE'] { --mdc-chip-elevated-container-color: var(--ct-green-50); color: var(--ct-green-600); }
      mat-chip[data-state='PENDING_APPROVAL'] { --mdc-chip-elevated-container-color: var(--ct-amber-50); color: var(--ct-amber-700); }
      mat-chip[data-state='ENDED'] { --mdc-chip-elevated-container-color: var(--ct-color-surface-alt); color: var(--ct-color-muted); }
    `,
  ],
})
export class AssignPositionPage implements OnInit {
  private readonly assignmentsSvc = inject(AssignmentsService);
  private readonly usersSvc = inject(UsersService);
  private readonly positionsSvc = inject(PositionsService);
  private readonly orgSvc = inject(OrgService);

  readonly users = signal<UserAccount[]>([]);
  readonly positions = signal<Position[]>([]);
  readonly units = signal<UnitOption[]>([]);
  readonly assignments = signal<Assignment[]>([]);

  readonly userId = signal('');
  readonly positionId = signal('');
  readonly unitId = signal('');
  readonly kind = signal<AssignmentInput.KindEnum>('HOLDER');
  readonly busy = signal(false);
  readonly ok = signal<{ id?: string; state?: string } | null>(null);
  readonly error = signal<{ status: number; message: string } | null>(null);

  readonly columns = ['user', 'position', 'unit', 'kind', 'validFrom', 'state'];

  ngOnInit(): void {
    this.usersSvc.listUsers(0, 100).subscribe((p) => this.users.set(p.items));
    this.positionsSvc.listPositions().subscribe((list) => this.positions.set(list));
    this.orgSvc.getOrgTree().subscribe((tree) => this.units.set(this.flatten(tree, 0)));
    this.reloadAssignments();
  }

  private flatten(nodes: OrgUnitNode[], depth: number): UnitOption[] {
    return nodes.flatMap((n) => [{ id: n.id, label: n.label, depth }, ...this.flatten(n.children ?? [], depth + 1)]);
  }

  private reloadAssignments(): void {
    this.assignmentsSvc.listAssignments(0, 50).subscribe((p) => this.assignments.set(p.items));
  }

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
    this.assignmentsSvc.createAssignment(input).subscribe({
      next: (a) => {
        this.ok.set({ id: a.id, state: a.state });
        this.busy.set(false);
        this.reloadAssignments();
      },
      error: (e: HttpErrorResponse) => {
        const detail = (e.error && (e.error.detail || e.error.title)) || e.message;
        this.error.set({ status: e.status, message: detail });
        this.busy.set(false);
      },
    });
  }

  kindLabel(k: keyof typeof ASSIGNMENT_KIND_LABELS): string {
    return ASSIGNMENT_KIND_LABELS[k] ?? k;
  }
  stateLabel(s: keyof typeof ASSIGNMENT_STATE_LABELS): string {
    return ASSIGNMENT_STATE_LABELS[s] ?? s;
  }
}
