import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import {
  AuthzSimulationResult,
  AuthzSimulationResultExplanationInner,

  AuthzSimulationService,
  Feature,
  RolesService,
  SimulateAuthorizationRequest,
  SimulateWhoCan200ResponseInner,
  UserAccount,
  UsersService,
} from '../../../libs/api-clients/admin-iam';
import { AUTHZ_RESULT_LABELS } from '../iam.labels';

type SimMode = 'user' | 'who';
type ResourceType = 'UNIT' | 'MISSION' | 'OBJECT';

/**
 * Simulateur d'habilitations (ADM-12, §2.1) — deux questions, deux appels du client généré (D32) :
 * « que peut faire X ? / X peut-il faire F sur R ? » (`simulateAuthorization`) et « qui peut faire F sur R ? »
 * (`simulateWhoCan`). Les réponses (décision, explication pas à pas, « via » la position) sont affichées telles
 * que le serveur les rend : le front n'enforce ni ne recalcule aucun droit. Chaque simulation est journalisée
 * côté serveur (elle révèle des droits) ; périmètre `admin.authz.simulate` appliqué côté serveur.
 */
@Component({
  selector: 'ct-authz-simulator',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  template: `
    <section data-cy="sim-page" [attr.data-ready]="ready()">
      <header class="page-head"><h1>Simulateur d'habilitations</h1></header>
      <p class="page-sub">Vérifier ce qu'une personne peut faire, ou qui peut faire une action sur une ressource. Chaque simulation est journalisée.</p>

      <mat-button-toggle-group class="mode" [value]="mode()" (change)="setMode($event.value)" data-cy="sim-mode" aria-label="Type de question">
        <mat-button-toggle value="user" data-cy="sim-mode-user">Que peut faire ce utilisateur ?</mat-button-toggle>
        <mat-button-toggle value="who" data-cy="sim-mode-who">Qui peut faire cette action ?</mat-button-toggle>
      </mat-button-toggle-group>

      <mat-card appearance="outlined" class="block">
        <mat-card-content>
          @if (mode() === 'user') {
            <form class="form" (submit)="$event.preventDefault(); runUser()">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Utilisateur</mat-label>
                <mat-select name="userId" data-cy="sim-user" [(ngModel)]="userId" required>
                  @for (u of users(); track u.id) {
                    <mat-option [value]="u.id">{{ u.displayName }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Fonctionnalité (facultatif)</mat-label>
                <mat-select name="featureCode" data-cy="sim-feature" [(ngModel)]="featureCode">
                  <mat-option [value]="''">— Toutes les fonctionnalités —</mat-option>
                  @for (f of features(); track f.code) {
                    <mat-option [value]="f.code">{{ f.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <ng-container [ngTemplateOutlet]="resourceFields"></ng-container>
              <div class="actions">
                <button mat-flat-button color="primary" type="submit" data-cy="sim-run" [disabled]="busy() || !userId()">
                  <mat-icon>manage_search</mat-icon> Simuler
                </button>
              </div>
            </form>
          } @else {
            <form class="form" (submit)="$event.preventDefault(); runWho()">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Fonctionnalité</mat-label>
                <mat-select name="whoFeature" data-cy="sim-who-feature" [(ngModel)]="featureCode" required>
                  @for (f of features(); track f.code) {
                    <mat-option [value]="f.code">{{ f.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <ng-container [ngTemplateOutlet]="resourceFields"></ng-container>
              <div class="actions">
                <button mat-flat-button color="primary" type="submit" data-cy="sim-who-run" [disabled]="busy() || !featureCode() || !resourceId()">
                  <mat-icon>group_search</mat-icon> Rechercher
                </button>
              </div>
            </form>
          }
          @if (error(); as e) {
            <p class="err" role="alert" data-cy="sim-error">✗ Erreur (HTTP {{ e.status }}) : {{ e.message }}</p>
          }
        </mat-card-content>
      </mat-card>

      @if (busy()) { <mat-progress-bar mode="indeterminate" data-cy="sim-loading"></mat-progress-bar> }

      @if (verdict(); as v) {
        <mat-card appearance="outlined" class="block" data-cy="sim-result">
          <mat-card-header><mat-card-title>Résultat</mat-card-title></mat-card-header>
          <mat-card-content>
            <p class="verdict" [attr.data-allowed]="v.allowed" data-cy="sim-verdict">
              <mat-icon aria-hidden="true">{{ v.allowed ? 'check_circle' : 'cancel' }}</mat-icon>
              {{ v.allowed ? 'Autorisé' : 'Non autorisé' }}
            </p>
            @if (v.features?.length) {
              <div class="chips" data-cy="sim-granted">
                @for (g of v.features; track g.code) {
                  <mat-chip-set><mat-chip disableRipple>{{ featureLabel(g.code) }}</mat-chip></mat-chip-set>
                }
              </div>
            }
            @if (v.explanation?.length) {
              <h2 class="sub">Explication</h2>
              <ol class="steps">
                @for (s of v.explanation; track $index) {
                  <li data-cy="sim-step">
                    <span>{{ s.step }}</span>
                    <span class="step-result" [attr.data-result]="s.result">{{ resultLabel(s.result) }}</span>
                  </li>
                }
              </ol>
            }
          </mat-card-content>
        </mat-card>
      }

      @if (who(); as w) {
        <mat-card appearance="outlined" class="block" data-cy="sim-who-result">
          <mat-card-header><mat-card-title>Personnes habilitées</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (w.length) {
              <ul class="who">
                @for (row of w; track $index) {
                  <li data-cy="sim-who-row"><strong>{{ row.user?.displayName }}</strong> <span class="muted">via {{ row.via }}</span></li>
                }
              </ul>
            } @else {
              <p class="muted" data-cy="sim-who-empty">Aucune personne habilitée sur cette ressource.</p>
            }
          </mat-card-content>
        </mat-card>
      }
    </section>

    <ng-template #resourceFields>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Type de ressource</mat-label>
        <mat-select name="resourceType" data-cy="sim-resource-type" [(ngModel)]="resourceType">
          <mat-option value="UNIT">Unité</mat-option>
          <mat-option value="MISSION">Mission</mat-option>
          <mat-option value="OBJECT">Objet</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Identifiant de la ressource</mat-label>
        <input matInput name="resourceId" data-cy="sim-resource-id" [(ngModel)]="resourceId" placeholder="UUID" />
      </mat-form-field>
      @if (mode() === 'user') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Date de simulation</mat-label>
          <input matInput type="date" name="at" data-cy="sim-at" [(ngModel)]="at" />
        </mat-form-field>
      }
    </ng-template>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .mode { margin-bottom: var(--ct-space-3); }
      .block { margin-top: var(--ct-space-3); }
      .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--ct-space-3); align-items: start; max-width: 860px; }
      .actions { grid-column: 1 / -1; }
      .sub { font-size: 1rem; margin: var(--ct-space-3) 0 var(--ct-space-2); }
      .muted { color: var(--ct-color-muted); }
      .err { color: var(--ct-red-700); font-weight: 600; margin-top: var(--ct-space-3); }
      .verdict { display: flex; align-items: center; gap: var(--ct-space-2); font-weight: 600; margin: 0; }
      .verdict[data-allowed='true'] { color: var(--ct-green-600); }
      .verdict[data-allowed='false'] { color: var(--ct-red-700); }
      .chips { margin-top: var(--ct-space-2); }
      .steps { padding-left: var(--ct-space-4); display: grid; gap: var(--ct-space-2); }
      .steps li { display: flex; justify-content: space-between; gap: var(--ct-space-3); }
      .step-result { font-size: 0.8rem; color: var(--ct-color-muted); white-space: nowrap; }
      .step-result[data-result='GRANTS'] { color: var(--ct-green-600); }
      .step-result[data-result='BLOCKED_BY_SOD'], .step-result[data-result='DOES_NOT_COVER'] { color: var(--ct-red-700); }
      .who { padding-left: var(--ct-space-4); display: grid; gap: var(--ct-space-2); }
    `,
  ],
})
export class AuthzSimulatorPage implements OnInit {
  private readonly simSvc = inject(AuthzSimulationService);
  private readonly usersSvc = inject(UsersService);
  private readonly rolesSvc = inject(RolesService);

  readonly mode = signal<SimMode>('user');
  readonly users = signal<UserAccount[]>([]);
  readonly features = signal<Feature[]>([]);
  readonly userId = signal('');
  readonly featureCode = signal('');
  readonly resourceType = signal<ResourceType>('UNIT');
  readonly resourceId = signal('');
  readonly at = signal('');
  readonly busy = signal(false);
  readonly verdict = signal<AuthzSimulationResult | null>(null);
  readonly who = signal<SimulateWhoCan200ResponseInner[] | null>(null);
  readonly error = signal<{ status: number; message: string } | null>(null);
  /** Référentiels (utilisateurs, fonctionnalités) chargés : les sélecteurs ne s'ouvrent qu'à partir de là. */
  readonly ready = computed(() => this.users().length > 0 && this.features().length > 0);

  ngOnInit(): void {
    this.usersSvc.listUsers(0, 100).subscribe((p) => this.users.set(p.items));
    this.rolesSvc.listFeatures().subscribe((list) => this.features.set(list));
  }

  setMode(mode: SimMode): void {
    this.mode.set(mode);
    this.featureCode.set('');
    this.resetResults();
  }

  runUser(): void {
    this.resetResults();
    const req: SimulateAuthorizationRequest = {
      userId: this.userId(),
      featureCode: this.featureCode() || undefined,
      resource: this.resourceId() ? { type: this.resourceType(), id: this.resourceId() } : undefined,
      at: this.at() || undefined,
    };
    this.busy.set(true);
    this.simSvc.simulateAuthorization(req).subscribe({
      next: (r) => {
        this.verdict.set(r);
        this.busy.set(false);
      },
      error: (e: HttpErrorResponse) => this.fail(e),
    });
  }

  runWho(): void {
    this.resetResults();
    this.busy.set(true);
    this.simSvc
      .simulateWhoCan({ featureCode: this.featureCode(), resource: { type: this.resourceType(), id: this.resourceId() } })
      .subscribe({
        next: (rows) => {
          this.who.set(rows);
          this.busy.set(false);
        },
        error: (e: HttpErrorResponse) => this.fail(e),
      });
  }

  featureLabel(code?: string): string {
    return this.features().find((f) => f.code === code)?.label ?? code ?? '';
  }

  resultLabel(r?: AuthzSimulationResultExplanationInner.ResultEnum): string {
    return r ? AUTHZ_RESULT_LABELS[r] : '';
  }

  private resetResults(): void {
    this.verdict.set(null);
    this.who.set(null);
    this.error.set(null);
  }

  private fail(e: HttpErrorResponse): void {
    const detail = (e.error && (e.error.detail || e.error.title)) || e.message;
    this.error.set({ status: e.status, message: detail });
    this.busy.set(false);
  }
}
