import { Injectable, signal } from '@angular/core';

// No backend exists for this lab, so "restricted access" is enforced against a fixed demo
// credential instead of a real user store — wrong credentials genuinely fail to authenticate.
const DEMO_USERNAME = 'MANNAZ';
const DEMO_PASSWORD = 'NZIBUKA123';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authenticated = signal(false);
  readonly isAuthenticated = this.authenticated.asReadonly();

  login(username: string, password: string): boolean {
    const success = username === DEMO_USERNAME && password === DEMO_PASSWORD;
    if (success) {
      this.authenticated.set(true);
    }
    return success;
  }

  logout(): void {
    this.authenticated.set(false);
  }
}
