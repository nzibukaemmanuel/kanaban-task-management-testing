import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { PreferencesService } from '../../core/preferences.service';

@Component({
  imports: [],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly preferencesService = inject(PreferencesService);

  // Present only when authGuard bounced the user here — lets the template explain *why*
  // they landed on the login page instead of the page they asked for.
  readonly returnUrl = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('returnUrl'))),
    { initialValue: this.route.snapshot.queryParamMap.get('returnUrl') },
  );

  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  submit(): void {
    const success = this.auth.login(this.username(), this.password());
    if (!success) {
      this.error.set('Incorrect username or password.');
      return;
    }
    this.error.set(null);
    const defaultBoardId = this.preferencesService.defaultBoardId();
    const fallbackUrl = defaultBoardId ? `/boards/${defaultBoardId}` : '/settings';
    this.router.navigateByUrl(this.returnUrl() ?? fallbackUrl);
  }
}
