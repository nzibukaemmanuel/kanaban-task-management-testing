import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PreferencesService } from '../../core/preferences.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('authenticates and navigates to /settings by default when credentials are correct', () => {
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.username.set('MANNAZ');
    component.password.set('NZIBUKA123');
    component.submit();

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/settings');
    expect(component.error()).toBeNull();
  });

  it('shows an error and does not navigate when credentials are wrong', () => {
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.username.set('admin');
    component.password.set('wrong-password');
    component.submit();

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
    expect(component.error()).toBe('Incorrect username or password.');
  });

  it('navigates to the configured default board instead of /settings when one is set', () => {
    TestBed.inject(PreferencesService).setDefaultBoardId('roadmap');
    const router = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.username.set('MANNAZ');
    component.password.set('NZIBUKA123');
    component.submit();

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/boards/roadmap');
  });

  it('toggles the password field between hidden and visible', () => {
    fixture.detectChanges();
    const passwordInput = (): HTMLInputElement =>
      fixture.nativeElement.querySelector('input[autocomplete="current-password"]');
    const toggleButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('.password-toggle');

    expect(passwordInput().type).toBe('password');
    expect(toggleButton().textContent?.trim()).toBe('Show');

    toggleButton().click();
    fixture.detectChanges();

    expect(passwordInput().type).toBe('text');
    expect(toggleButton().textContent?.trim()).toBe('Hide');

    toggleButton().click();
    fixture.detectChanges();

    expect(passwordInput().type).toBe('password');
  });
});
