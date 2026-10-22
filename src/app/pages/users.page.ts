import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { UserAccount, UserPage, UsersService } from '../../../libs/api-clients/admin-iam';
import { ACCOUNT_STATUS_LABELS, USER_SOURCE_LABELS } from '../iam.labels';

/**
 * Annuaire des utilisateurs (Admin Système IAM, §2.1) : recherche libre + filtres statut / source, côté
 * serveur et reflétés dans l'URL (`?q=&status=&source=&page=`, partageable). Lignes cliquables vers la
 * fiche (profil). Le serveur applique le périmètre `iam.user.read` (D32). Style « épuré & dense ».
 */
@Component({
  selector: 'ct-users',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <section>
      <header class="page-head">
        <h1>Utilisateurs</h1>
        <a mat-flat-button color="primary" (click)="create()" data-cy="users-create"><mat-icon>person_add</mat-icon> Créer un utilisateur</a>
      </header>
      <p class="page-sub">Annuaire des comptes (annuaire d'entreprise et comptes locaux) et leur affectation.</p>

      <mat-card appearance="outlined">
        <mat-card-content>
          <form class="filters" (submit)="$event.preventDefault(); apply(qF.value, statusF.value, sourceF.value)">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
              <mat-label>Rechercher</mat-label>
              <input matInput #qF type="search" [value]="filters().q" placeholder="nom, identifiant ou courriel" data-cy="users-search" />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
              <mat-label>Statut</mat-label>
              <mat-select #statusF [value]="filters().status" data-cy="users-status">
                <mat-option value="">Tous</mat-option>
                @for (s of statuses; track s) { <mat-option [value]="s">{{ statusLabel(s) }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
              <mat-label>Source</mat-label>
              <mat-select #sourceF [value]="filters().source" data-cy="users-source">
                <mat-option value="">Toutes</mat-option>
                <mat-option value="AD">Annuaire (AD)</mat-option>
                <mat-option value="LOCAL">Compte local</mat-option>
              </mat-select>
            </mat-form-field>
            <div class="filter-actions">
              <button mat-flat-button color="primary" type="submit" data-cy="users-apply">Filtrer</button>
              <button mat-stroked-button type="button" (click)="reset()" data-cy="users-reset">Réinitialiser</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      @if (page(); as p) {
        @if (p.items.length) {
          <mat-card appearance="outlined" class="table-card">
            <table mat-table [dataSource]="p.items" data-cy="users-table">
              <ng-container matColumnDef="user">
                <th mat-header-cell *matHeaderCellDef>Utilisateur</th>
                <td mat-cell *matCellDef="let u">
                  <div class="u-name">{{ u.displayName }}</div>
                  <div class="u-sub"><code>{{ u.username }}</code></div>
                </td>
              </ng-container>
              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef>Courriel</th>
                <td mat-cell *matCellDef="let u">{{ u.email ?? '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="source">
                <th mat-header-cell *matHeaderCellDef>Source</th>
                <td mat-cell *matCellDef="let u"><span class="muted">{{ sourceLabel(u.source) }}</span></td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Statut</th>
                <td mat-cell *matCellDef="let u">
                  <mat-chip-set><mat-chip disableRipple [attr.data-status]="u.accountStatus">{{ statusLabel(u.accountStatus) }}</mat-chip></mat-chip-set>
                </td>
              </ng-container>
              <ng-container matColumnDef="assignments">
                <th mat-header-cell *matHeaderCellDef class="num">Affectations</th>
                <td mat-cell *matCellDef="let u" class="num">{{ u.assignments?.length ?? 0 }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
              <tr mat-row *matRowDef="let row; columns: columns" data-cy="user-row" class="clickable" (click)="open(row)"></tr>
            </table>
          </mat-card>
        } @else {
          <p data-cy="users-empty">Aucun utilisateur pour ces critères.</p>
        }
      } @else {
        <mat-progress-bar mode="indeterminate" aria-label="Chargement"></mat-progress-bar>
      }
    </section>
  `,
  styles: [
    `
      .page-head { display: flex; align-items: center; justify-content: space-between; gap: var(--ct-space-4); flex-wrap: wrap; }
      .page-sub { color: var(--ct-color-muted); margin-top: 0; }
      .filters { display: flex; flex-wrap: wrap; gap: var(--ct-space-3); align-items: center; }
      .filters .grow { flex: 1 1 260px; min-width: 220px; }
      .filters .dense { width: 190px; }
      .filter-actions { display: flex; gap: var(--ct-space-2); align-items: center; }
      .table-card { margin-top: var(--ct-space-4); padding: 0; overflow: hidden; }
      table[mat-table] { width: 100%; background: transparent; }
      th.mat-mdc-header-cell { background: var(--ct-color-surface); }
      tr.clickable { cursor: pointer; }
      tr.clickable:hover { background: var(--ct-color-primary-soft); }
      code { font-family: var(--ct-font-mono); }
      .u-name { font-weight: 600; }
      .u-sub { color: var(--ct-color-muted); font-size: 0.82rem; }
      .muted { color: var(--ct-color-muted); }
      .num { text-align: right; } td.num { font-variant-numeric: tabular-nums; }
      mat-chip[data-status='ACTIVE'] { --mdc-chip-elevated-container-color: var(--ct-green-50); color: var(--ct-green-600); }
      mat-chip[data-status='LOCKED'] { --mdc-chip-elevated-container-color: var(--ct-amber-50); color: var(--ct-amber-700); }
      mat-chip[data-status='DISABLED'] { --mdc-chip-elevated-container-color: var(--ct-red-50); color: var(--ct-red-700); }
      mat-chip[data-status='NO_ASSIGNMENT'] { --mdc-chip-elevated-container-color: var(--ct-color-surface-alt); color: var(--ct-color-muted); }
    `,
  ],
})
export class UsersPage implements OnInit {
  private readonly service = inject(UsersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly page = signal<UserPage | null>(null);
  readonly filters = signal<{ q: string; status: string; source: string }>({ q: '', status: '', source: '' });
  readonly statuses = Object.values(UserAccount.AccountStatusEnum);
  readonly columns = ['user', 'email', 'source', 'status', 'assignments'];

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const q = params.get('q') ?? '';
      const status = params.get('status') ?? '';
      const source = params.get('source') ?? '';
      this.filters.set({ q, status, source });
      this.page.set(null);
      this.service
        .listUsers(
          0,
          20,
          undefined,
          q || undefined,
          undefined,
          (source || undefined) as UserAccount.SourceEnum | undefined,
          (status || undefined) as UserAccount.AccountStatusEnum | undefined,
        )
        .subscribe((p) => this.page.set(p));
    });
  }

  open(u: UserAccount): void {
    this.router.navigate(['/users', u.id]);
  }

  create(): void {
    this.router.navigate(['/users/new']);
  }

  apply(q: string, status: string, source: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: q || null, status: status || null, source: source || null },
      queryParamsHandling: 'merge',
    });
  }

  reset(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  statusLabel(s: UserAccount.AccountStatusEnum): string {
    return ACCOUNT_STATUS_LABELS[s] ?? s;
  }

  sourceLabel(s: UserAccount.SourceEnum): string {
    return USER_SOURCE_LABELS[s] ?? s;
  }
}
