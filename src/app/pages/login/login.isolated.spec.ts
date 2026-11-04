import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { PreferencesService } from '../../core/preferences.service';
import { Login } from './login';

// AuthService, Router, ActivatedRoute and PreferencesService are all Jest mocks here, so the
// tests pin down exactly what Login asks of each collaborator and how it reacts to the answers.
describe('Login (isolated from its services)', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const auth = { login: jest.fn<boolean, [string, string]>() };
  const router = { navigateByUrl: jest.fn() };
  const preferences = { defaultBoardId: jest.fn<string, []>() };

  const el = () => fixture.nativeElement as HTMLElement;
  const input = (label: string) =>
    Array.from(el().querySelectorAll<HTMLLabelElement>('label'))
      .find((node) => node.textContent?.trim().startsWith(label))!
      .querySelector('input')!;
  const type = (field: HTMLInputElement, text: string) => {
    field.value = text;
    field.dispatchEvent(new Event('input'));
  };
  const submitForm = () => {
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  function setup(returnUrl: string | null = null) {
    queryParams = new BehaviorSubject(convertToParamMap(returnUrl ? { returnUrl } : {}));
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: PreferencesService, useValue: preferences },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParams, snapshot: { queryParamMap: queryParams.value } },
        },
      ],
    });
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    preferences.defaultBoardId.mockReturnValue('');
    auth.login.mockReturnValue(false);
  });

  it('starts empty, with no error and the password hidden', () => {
    setup();

    expect(component.username()).toBe('');
    expect(component.password()).toBe('');
    expect(component.error()).toBeNull();
    expect(input('Password').type).toBe('password');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('passes exactly what was typed to AuthService.login, once', () => {
    setup();
    type(input('Username'), 'MANNAZ');
    type(input('Password'), 's3cret');

    submitForm();

    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(auth.login).toHaveBeenCalledWith('MANNAZ', 's3cret');
  });

  describe('when AuthService rejects the credentials', () => {
    beforeEach(() => {
      setup();
      auth.login.mockReturnValue(false);
      submitForm();
    });

    it('shows an alert and does not navigate', () => {
      expect(el().querySelector('[role="alert"]')?.textContent).toContain(
        'Incorrect username or password.',
      );
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not even look up the default board', () => {
      expect(preferences.defaultBoardId).not.toHaveBeenCalled();
    });

    it('clears the error once a later attempt succeeds', () => {
      auth.login.mockReturnValue(true);

      submitForm();

      expect(component.error()).toBeNull();
      expect(el().querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('when AuthService accepts the credentials', () => {
    beforeEach(() => auth.login.mockReturnValue(true));

    it('goes to /settings when there is neither a return URL nor a default board', () => {
      setup();

      submitForm();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/settings');
    });

    it('goes to the default board from preferences when there is no return URL', () => {
      preferences.defaultBoardId.mockReturnValue('roadmap');
      setup();

      submitForm();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/boards/roadmap');
    });

    it('prefers the page the user originally asked for over the default board', () => {
      preferences.defaultBoardId.mockReturnValue('roadmap');
      setup('/boards/platform-launch/tasks/design-review');

      submitForm();

      expect(router.navigateByUrl).toHaveBeenCalledWith(
        '/boards/platform-launch/tasks/design-review',
      );
    });

    it('follows a return URL that appears in the route after the page was created', () => {
      setup();
      queryParams.next(convertToParamMap({ returnUrl: '/boards/marketing-plan' }));

      submitForm();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/boards/marketing-plan');
    });
  });

  it('exposes the return URL so the page can explain why the user was sent here', () => {
    setup('/boards/roadmap');

    expect(component.returnUrl()).toBe('/boards/roadmap');
  });

  it('toggles password visibility without involving any service', () => {
    setup();
    const toggle = el().querySelector<HTMLButtonElement>('.password-toggle')!;

    toggle.click();
    fixture.detectChanges();

    expect(input('Password').type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(auth.login).not.toHaveBeenCalled();
  });
});
