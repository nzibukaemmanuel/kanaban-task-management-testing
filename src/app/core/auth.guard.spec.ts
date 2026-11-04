import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('allows navigation when the user is authenticated', () => {
    TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/settings' } as any),
    );

    expect(result).toBe(true);
  });

  it('redirects to /login with a returnUrl when not authenticated', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/settings' } as any),
    ) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/login?returnUrl=%2Fsettings');
  });
});
