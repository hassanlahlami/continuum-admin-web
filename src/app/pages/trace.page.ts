import { DatePipe, JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EMPTY } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { LogsService, Trace } from '../../../libs/api-clients/operations';

/**
 * Trace d'une requête (OPS-09, §10.8) : à partir de la référence d'erreur donnée par l'utilisateur, frise des étapes
 * (service, durée, décalage), étape en erreur avec son code d'événement (lien vers OPS-10), logs associés.
 * Droit `admin.logs.tech.read` appliqué par le serveur (403). Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-trace',
  standalone: true,
  imports: [DatePipe, JsonPipe, MatCardModule, MatProgressBarModule, RouterLink],
  template: `
    <section>
      <header class="page-head"><h1>Trace d'une requête</h1></header>
      <p class="page-sub mono" data-cy="trace-id">{{ traceId() }}</p>

      @if (error()) {
        <p class="error" role="alert" data-cy="trace-error">{{ error() }}</p>
      }
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" data-cy="trace-loading"></mat-progress-bar>
      }

      @if (trace(); as t) {
        <mat-card appearance="outlined" class="card">
          <mat-card-content>
            <p data-cy="trace-summary">
              <span data-cy="trace-outcome" [class.error]="t.outcome === 'ERROR'">{{ t.outcome === 'ERROR' ? 'En erreur' : 'Réussie' }}</span>
              · {{ t.durationMs }} ms · {{ t.startedAt | date: 'dd/MM/yyyy HH:mm:ss' }}
            </p>
            <ol class="timeline" data-cy="trace-spans">
              @for (s of t.spans; track s.spanId) {
                <li data-cy="trace-span" [class.failed]="s.status === 'ERROR'">
                  <div class="label">
                    <strong data-cy="span-service">{{ s.service }}</strong>
                    <span class="mono">{{ s.name }}</span>
                    @if (s.eventCode) {
                      <a [routerLink]="['/errors']" [queryParams]="{ code: s.eventCode }" class="mono" data-cy="span-code">{{ s.eventCode }}</a>
                    }
                  </div>
                  <div class="track">
                    <div class="bar" [style.left.%]="pct(s.startOffsetMs, t)" [style.width.%]="width(s.durationMs, t)"></div>
                  </div>
                  <span class="muted">{{ s.durationMs }} ms</span>
                </li>
              }
            </ol>
          </mat-card-content>
        </mat-card>

        <h2 class="detail-title">Logs associés</h2>
        @for (l of t.logs ?? []; track $index) {
          <pre class="detail" data-cy="trace-log">{{ l | json }}</pre>
        } @empty {
          <p class="muted" data-cy="trace-logs-empty">Aucun log associé.</p>
        }
      }
    </section>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; }
      .error { color: var(--ct-red-700); }
      .card { margin-top: var(--ct-space-4); }
      .timeline { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--ct-space-2); }
      .timeline li { display: grid; grid-template-columns: 22rem 1fr 5rem; gap: var(--ct-space-3); align-items: center; }
      .label { display: flex; flex-direction: column; font-size: 0.85em; }
      .track { position: relative; height: 0.75rem; background: var(--ct-color-muted-bg, transparent); border-radius: var(--ct-radius-sm); }
      .bar { position: absolute; top: 0; bottom: 0; min-width: 2px; background: var(--ct-color-primary); border-radius: var(--ct-radius-sm); }
      li.failed .bar { background: var(--ct-red-700); }
      .detail-title { font-size: 1rem; margin: var(--ct-space-4) 0 var(--ct-space-2); }
      .detail { background: var(--ct-color-muted-bg, transparent); padding: var(--ct-space-3); overflow: auto; font-family: var(--ct-font-mono); font-size: 0.82em; }
      .mono { font-family: var(--ct-font-mono); font-size: 0.82em; }
      .muted { color: var(--ct-color-muted); }
    `,
  ],
})
export class TracePage {
  private readonly service = inject(LogsService);
  private readonly route = inject(ActivatedRoute);
  readonly traceId = signal('');
  readonly trace = signal<Trace | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.route.paramMap
      .pipe(
        map((p) => p.get('traceId') ?? ''),
        tap((id) => {
          this.traceId.set(id);
          this.trace.set(null);
          this.error.set('');
          this.loading.set(true);
        }),
        switchMap((id) =>
          this.service.getTrace(id).pipe(
            catchError((e: HttpErrorResponse) => {
              this.loading.set(false);
              this.error.set(
                e.status === 404 ? 'Aucune trace pour cette référence.'
                : e.status === 403 ? 'Accès refusé : droits insuffisants pour cette action.'
                : 'Chargement de la trace impossible.',
              );
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((t) => {
        this.loading.set(false);
        this.trace.set(t);
      });
  }

  pct(offset: number | undefined, t: Trace): number {
    return t.durationMs ? Math.min(100, ((offset ?? 0) / t.durationMs) * 100) : 0;
  }

  width(duration: number | undefined, t: Trace): number {
    return t.durationMs ? Math.max(1, ((duration ?? 0) / t.durationMs) * 100) : 100;
  }
}
