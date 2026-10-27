import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { EntityAllOfAvailableActions as AvailableAction, UserAccount, UsersService } from '../../../libs/api-clients/admin-iam';
import { ACCOUNT_STATUS_LABELS, ASSIGNMENT_KIND_LABELS, ASSIGNMENT_STATE_LABELS, USER_SOURCE_LABELS } from '../iam.labels';

/**
 * Fiche (profil) d'un utilisateur (Admin Système IAM, §2.1) : identité, état du compte, sécurité (MFA,
 * sessions) et affectations actives. Actions de compte (`performUserAction`) proposées par le serveur
 * (`availableActions`) ; motif exigé quand l'action le demande ; refus 403 / conflit 409 / 422 affichés tels quels. Composants Material / tokens --ct-*.
 */
@Component({
  selector: 'ct-user-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, MatCardModule, MatFormFieldModule, MatInputModule, MatTableModule, MatChipsModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <section>
      <a mat-button routerLink="/users"><mat-icon>arrow_back</mat-icon> Utilisateurs</a>
      @if (user(); as u) {
        <mat-card appearance="outlined" class="block">
          <mat-card-header>
            <div mat-card-avatar class="avatar" aria-hidden="true">{{ initials(u.displayName) }}</div>
            <mat-card-title data-cy="user-name">{{ u.displayName }}</mat-card-title>
            <mat-card-subtitle><code>{{ u.username }}</code> · {{ sourceLabel(u.source) }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-chip-set>
              <mat-chip disableRipple data-cy="user-status" [attr.data-status]="u.accountStatus">{{ statusLabel(u.accountStatus) }}</mat-chip>
              @if (u.mfaConfigured) {
                <mat-chip disableRipple class="ok"><mat-icon>verified_user</mat-icon> MFA actif</mat-chip>
              } @else {
                <mat-chip disableRipple class="warn"><mat-icon>gpp_maybe</mat-icon> MFA non configuré</mat-chip>
              }
            </mat-chip-set>
            <dl class="info">
              <dt>Courriel</dt><dd>{{ u.email ?? '—' }}</dd>
              <dt>Source du compte</dt><dd>{{ sourceLabel(u.source) }}</dd>
              <dt>Dernière connexion</dt><dd>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'dd/MM/yyyy HH:mm') : 'Jamais' }}</dd>
              <dt>Sessions actives</dt><dd>{{ u.activeSessions ?? 0 }}</dd>
            </dl>
            @if (message(); as m) { <p class="ok" role="status" data-cy="user-message">{{ m }}</p> }
            @if (error(); as e) { <p class="err" role="alert" data-cy="user-error">{{ errorHint(e) }}</p> }
            @if (u.availableActions?.length) {
              <div class="actions">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
                  <mat-label>Motif</mat-label>
                  <input matInput #reason name="reason" data-cy="user-reason" />
                </mat-form-field>
                @for (a of u.availableActions; track a.code) {
                  <button mat-stroked-button type="button" [attr.data-cy]="'user-action-' + a.code" [attr.data-style]="a.style"
                          [disabled]="busy() || (a.requiresComment && !reason.value.trim())"
                          (click)="run(u, a, reason.value); reason.value = ''">{{ a.label }}</button>
                }
              </div>
            }
            <p class="links">
              <a mat-button routerLink="/assignments" data-cy="user-assign"><mat-icon>assignment_ind</mat-icon> Affecter une position</a>
              <a mat-button routerLink="/authz-simulator" data-cy="user-effective-rights"><mat-icon>rule</mat-icon> Droits effectifs (simulateur)</a>
            </p>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="block">
          <mat-card-header><mat-card-title>Affectations</mat-card-title></mat-card-header>
          @if (u.assignments?.length) {
            <table mat-table [dataSource]="u.assignments ?? []" data-cy="user-assignments">
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
              <ng-container matColumnDef="period">
                <th mat-header-cell *matHeaderCellDef>Période</th>
                <td mat-cell *matCellDef="let a">
                  {{ a.validFrom | date: 'dd/MM/yyyy' }}<span class="muted"> → </span>{{ a.validTo ? (a.validTo | date: 'dd/MM/yyyy') : '…' }}
                </td>
              </ng-container>
              <ng-container matColumnDef="state">
                <th mat-header-cell *matHeaderCellDef>État</th>
                <td mat-cell *matCellDef="let a">
                  <mat-chip-set><mat-chip disableRipple [attr.data-state]="a.state">{{ stateLabel(a.state) }}</mat-chip></mat-chip-set>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="assignmentColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: assignmentColumns" data-cy="user-assignment-row"></tr>
            </table>
          } @else {
            <mat-card-content><p data-cy="user-assignments-empty">Aucune affectation active.</p></mat-card-content>
          }
        </mat-card>
      } @else {
        <mat-progress-bar mode="indeterminate" aria-label="Chargement"></mat-progress-bar>
      }
    </section>
  `,
  styles: [
    `
      .block { margin-top: var(--ct-space-4); }
      table[mat-table] { width: 100%; background: transparent; }
      code { font-family: var(--ct-font-mono); }
      .avatar { display: grid; place-items: center; font-weight: 700; color: var(--ct-color-primary); background: var(--ct-color-primary-soft); border-radius: 50%; }
      .info { display: grid; grid-template-columns: max-content 1fr; gap: var(--ct-space-1) var(--ct-space-4); margin: var(--ct-space-3) 0 0; }
      .info dt { color: var(--ct-color-muted); } .info dd { margin: 0; font-weight: 600; }
      .actions { display: flex; flex-wrap: wrap; gap: var(--ct-space-2); align-items: center; margin-top: var(--ct-space-3); }
      .actions .dense { width: 260px; }
      button[data-style='danger'] { color: var(--ct-red-700); }
      .ok { color: var(--ct-green-600); } .err { color: var(--ct-red-700); }
      .muted { color: var(--ct-color-muted); font-weight: 400; }
      mat-chip.ok { --mdc-chip-elevated-container-color: var(--ct-green-50); color: var(--ct-green-600); }
      mat-chip.warn { --mdc-chip-elevated-container-color: var(--ct-amber-50); color: var(--ct-amber-700); }
      mat-chip mat-icon { font-size: 16px; height: 16px; width: 16px; }
      mat-chip[data-status='ACTIVE'] { --mdc-chip-elevated-container-color: var(--ct-green-50); color: var(--ct-green-600); }
      mat-chip[data-status='LOCKED'] { --mdc-chip-elevated-container-color: var(--ct-amber-50); color: var(--ct-amber-700); }
      mat-chip[data-status='DISABLED'] { --mdc-chip-elevated-container-color: var(--ct-red-50); color: var(--ct-red-700); }
      mat-chip[data-status='NO_ASSIGNMENT'] { --mdc-chip-elevated-container-color: var(--ct-color-surface-alt); color: var(--ct-color-muted); }
      mat-chip[data-state='ACTIVE'] { --mdc-chip-elevated-container-color: var(--ct-green-50); color: var(--ct-green-600); }
      mat-chip[data-state='PENDING_APPROVAL'] { --mdc-chip-elevated-container-color: var(--ct-amber-50); color: var(--ct-amber-700); }
      mat-chip[data-state='ENDED'] { --mdc-chip-elevated-container-color: var(--ct-color-surface-alt); color: var(--ct-color-muted); }
    `,
  ],
})
export class UserDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(UsersService);
  readonly user = signal<UserAccount | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal<number | null>(null);
  readonly assignmentColumns = ['position', 'unit', 'kind', 'period', 'state'];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('userId') ?? '';
    if (id) {
      this.service.getUser(id).subscribe((u) => this.user.set(u));
    }
  }

  run(u: UserAccount, a: AvailableAction, reason: string): void {
    if (a.confirmationMessage && !confirm(a.confirmationMessage)) return;
    this.busy.set(true);
    this.message.set('');
    this.error.set(null);
    this.service.performUserAction(u.id, a.code, { version: u.version ?? 0, comment: reason.trim() || undefined }).subscribe({
      next: (r) => { this.user.set(r); this.busy.set(false); this.message.set('Action « ' + a.label + ' » effectuée.'); },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.error.set(err.status); },
    });
  }

  errorHint(code: number): string {
    if (code === 403) return 'Action refusée par le serveur : droits insuffisants ou action sur son propre compte.';
    if (code === 409) return 'Conflit : le compte a été modifié entre-temps. Rechargez la page.';
    if (code === 422) return 'Motif obligatoire pour cette action.';
    return 'Impossible d’effectuer l’action.';
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  }

  statusLabel(s: UserAccount.AccountStatusEnum): string {
    return ACCOUNT_STATUS_LABELS[s] ?? s;
  }
  sourceLabel(s: UserAccount.SourceEnum): string {
    return USER_SOURCE_LABELS[s] ?? s;
  }
  kindLabel(k: keyof typeof ASSIGNMENT_KIND_LABELS): string {
    return ASSIGNMENT_KIND_LABELS[k] ?? k;
  }
  stateLabel(s: keyof typeof ASSIGNMENT_STATE_LABELS): string {
    return ASSIGNMENT_STATE_LABELS[s] ?? s;
  }
}
