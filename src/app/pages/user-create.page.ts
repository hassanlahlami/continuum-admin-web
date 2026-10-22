import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { CreateLocalUserRequest, UsersService } from '../../../libs/api-clients/admin-iam';

/**
 * Création d'un compte local (Admin Système IAM, §2.1) : pour les utilisateurs hors annuaire d'entreprise.
 * Appelle `POST /api/admin/users` (createLocalUser) via le client généré (D32). Le backend valide
 * (unicité de l'identifiant, format du courriel → 409/422) ; le front affiche la décision, n'enforce rien.
 */
@Component({
  selector: 'ct-user-create',
  standalone: true,
  imports: [FormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <section>
      <a mat-button routerLink="/users"><mat-icon>arrow_back</mat-icon> Utilisateurs</a>
      <h1>Créer un utilisateur local</h1>
      <p class="page-sub">Pour un utilisateur qui n'existe pas dans l'annuaire d'entreprise. Les comptes de l'annuaire sont synchronisés automatiquement.</p>

      <mat-card appearance="outlined" class="block">
        <mat-card-content>
          <form class="form" (submit)="$event.preventDefault(); submit()">
            <div class="row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Prénom</mat-label>
                <input matInput name="firstName" data-cy="create-firstname" [(ngModel)]="firstName" required />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Nom</mat-label>
                <input matInput name="lastName" data-cy="create-lastname" [(ngModel)]="lastName" required />
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Identifiant</mat-label>
              <input matInput name="username" data-cy="create-username" [(ngModel)]="username" required placeholder="prenom.nom" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Courriel</mat-label>
              <input matInput name="email" type="email" data-cy="create-email" [(ngModel)]="email" required />
            </mat-form-field>

            <div class="actions">
              <button mat-flat-button color="primary" type="submit" data-cy="create-submit" [disabled]="busy() || !valid()">Créer le compte</button>
              <a mat-stroked-button routerLink="/users">Annuler</a>
            </div>
          </form>

          @if (error(); as e) {
            <p class="err" role="alert" data-cy="create-error">✗ {{ e }}</p>
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 70ch; }
      .block { margin-top: var(--ct-space-2); max-width: 640px; }
      .form { display: flex; flex-direction: column; gap: var(--ct-space-2); }
      .row { display: flex; gap: var(--ct-space-3); flex-wrap: wrap; }
      .row mat-form-field { flex: 1 1 200px; }
      .actions { display: flex; gap: var(--ct-space-2); align-items: center; margin-top: var(--ct-space-3); }
      .err { color: var(--ct-red-700); font-weight: 600; }
    `,
  ],
})
export class UserCreatePage {
  private readonly service = inject(UsersService);
  private readonly router = inject(Router);

  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly username = signal('');
  readonly email = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  valid(): boolean {
    return !!(this.firstName().trim() && this.lastName().trim() && this.username().trim() && this.email().trim());
  }

  submit(): void {
    if (!this.valid()) {
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    const request: CreateLocalUserRequest = {
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      username: this.username().trim(),
      email: this.email().trim(),
    };
    this.service.createLocalUser(request).subscribe({
      next: (u) => {
        this.busy.set(false);
        this.router.navigate(['/users', u.id]);
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.messageFor(e));
      },
    });
  }

  private messageFor(e: HttpErrorResponse): string {
    const detail = e.error?.detail ?? e.error?.title;
    switch (e.status) {
      case 409:
        return detail ?? 'Un compte avec cet identifiant existe déjà.';
      case 422:
        return detail ?? 'Données invalides (identifiant ou courriel).';
      case 403:
        return 'Création non autorisée.';
      default:
        return detail ?? 'Échec de la création. Réessayez.';
    }
  }
}
