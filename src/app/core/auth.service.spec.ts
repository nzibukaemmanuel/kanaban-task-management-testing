import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('authenticates and returns true for the correct demo credentials', () => {
    const result = service.login('MANNAZ', 'NZIBUKA123');

    expect(result).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('rejects incorrect credentials and stays unauthenticated', () => {
    const result = service.login('MANANZ', 'wrong-password');

    expect(result).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('rejects an empty username/password', () => {
    expect(service.login('', '')).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('logs out an authenticated user', () => {
    service.login('admin', 'admin123');
    service.logout();

    expect(service.isAuthenticated()).toBe(false);
  });
});
