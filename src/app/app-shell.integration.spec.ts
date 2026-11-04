import { HttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
  withRouterConfig,
} from '@angular/router';
import { waitFor } from '../testing/wait-for';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { NotificationService } from './core/notification.service';
import { PreferencesService } from './core/preferences.service';
import { ThemeService } from './core/theme.service';
import { BoardService } from './features/board/board.service';
import { provideTaskStoreForTests } from './features/board/store/testing';

// The real App shell (header, notice banner, router outlets) with the real routes, store and
// services. The services below are app-wide singletons, so a change made in one place — the
// header, the Settings page, the Login page — has to show up in every other place that reads it.
describe('App shell: shared state across pages (integration)', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim();
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const login = () => TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
  const go = async (url: string) => {
    await router.navigateByUrl(url);
    await settle();
  };
  const headerLinks = () => Array.from(el().querySelectorAll('.app-nav a')).map((a) => text(a));
  const themeToggle = () => el().querySelector<HTMLButtonElement>('.theme-toggle')!;
  const typeInto = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = (form: Element | null) =>
    form!.dispatchEvent(new Event('submit', { cancelable: true }));
  const radio = (value: string) =>
    el().querySelector<HTMLInputElement>(`.settings-form input[type="radio"][value="${value}"]`)!;
  const checkbox = (labelStart: string) =>
    Array.from(el().querySelectorAll<HTMLLabelElement>('.settings-checkbox'))
      .find((label) => text(label)?.startsWith(labelStart))!
      .querySelector('input')!;

  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(
          routes,
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        provideTaskStoreForTests({ seeded: false }),
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    await settle();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    jest.restoreAllMocks();
  });

  describe('initial data load', () => {
    it('loads boards and tasks once at the root, and every page then reads the cache', async () => {
      const get = jest.spyOn(TestBed.inject(HttpClient), 'get');
      await go('/boards');
      await waitFor(() => expect(el().querySelectorAll('.board-card').length).toBeGreaterThan(0));
      const callsAfterFirstPage = get.mock.calls.length;

      TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
      await go('/boards/roadmap');
      await go('/boards/platform-launch');
      await go('/boards');
      login();
      await go('/settings');

      expect(get.mock.calls.length).toBe(callsAfterFirstPage);
    });

    it('shows the same boards on the list page and in the sidebar that the service holds', async () => {
      await go('/boards');
      await waitFor(() => expect(TestBed.inject(BoardService).loaded()).toBe(true));
      await settle();

      const ids = TestBed.inject(BoardService).boardIds();
      const cards = Array.from(el().querySelectorAll('.board-card__name')).map((n) => text(n));
      const sidebar = Array.from(el().querySelectorAll('.board-sidebar__label')).map((n) =>
        text(n),
      );
      expect(cards).toEqual([...ids]);
      expect(sidebar).toEqual([...ids]);
    });
  });

  describe('theme', () => {
    it('applies the header toggle to <html> and to the toggle label', async () => {
      await go('/boards');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(text(themeToggle())).toContain('Dark');

      themeToggle().click();
      await settle();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(text(themeToggle())).toContain('Light');
      expect(themeToggle().getAttribute('aria-label')).toBe('Switch to light theme');
    });

    it('updates an open Settings form when the header toggle is used and the field is untouched', async () => {
      TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
      login();
      await go('/settings');
      expect(radio('light').checked).toBe(true);

      themeToggle().click();
      await settle();

      expect(radio('dark').checked).toBe(true);
      expect(radio('light').checked).toBe(false);
    });

    it('does not overwrite a theme choice the user has already made in the form', async () => {
      login();
      await go('/settings');
      radio('dark').click();
      await settle();

      TestBed.inject(ThemeService).setTheme('light'); // changed elsewhere meanwhile
      await settle();

      expect(radio('dark').checked).toBe(true);
    });

    it('saving Settings changes the header, <html> and persists the choice', async () => {
      login();
      await go('/settings');
      radio('dark').click();
      await settle();

      submit(el().querySelector('.settings-form'));
      await waitFor(() => expect(router.url).toBe('/boards'));
      await settle();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(text(themeToggle())).toContain('Light');
      expect(localStorage.getItem('kanban-theme')).toBe('dark');
    });
  });

  describe('authentication', () => {
    it('swaps Log in for Log out in the header, and unlocks the add-board form', async () => {
      await go('/boards');
      await waitFor(() => expect(el().querySelectorAll('.board-card').length).toBeGreaterThan(0));
      expect(headerLinks()).toContain('Log in');
      expect(el().querySelector('.new-board')).toBeNull();

      TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
      await settle();

      expect(headerLinks()).not.toContain('Log in');
      expect(text(el().querySelector('.link-button'))).toBe('Log out');
      expect(el().querySelector('.new-board')).not.toBeNull();
    });

    it('logs in through the form, lands on the default board from Settings, and shows the new header', async () => {
      TestBed.inject(PreferencesService).setDefaultBoardId('roadmap');
      await go('/login');

      const [username, password] = Array.from(
        el().querySelectorAll<HTMLInputElement>('.login-form input'),
      );
      typeInto(username, 'MANNAZ');
      typeInto(password, 'NZIBUKA123');
      submit(el().querySelector('.login-form'));

      await waitFor(() => expect(router.url).toBe('/boards/roadmap'));
      await settle();
      expect(text(el().querySelector('.link-button'))).toBe('Log out');
      expect(text(el().querySelector('h1'))).toBe('roadmap');
    });

    it('logging out returns to /boards, restores Log in and locks the board pages again', async () => {
      TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
      await go('/boards/roadmap');

      el().querySelector<HTMLButtonElement>('.link-button')!.click();
      await waitFor(() => expect(router.url).toBe('/boards'));
      await settle();

      expect(headerLinks()).toContain('Log in');
      expect(el().querySelector('.new-board')).toBeNull();

      await go('/boards/roadmap');
      expect(router.url).toContain('/login?returnUrl=');
    });
  });

  describe('notifications', () => {
    it('shows a notice posted by any page in the shell banner, and Dismiss clears it', async () => {
      await go('/boards');

      TestBed.inject(NotificationService).success('Saved somewhere.');
      await settle();
      const banner = el().querySelector('app-notice .banner');
      expect(text(banner)).toContain('Saved somewhere.');
      expect(banner?.getAttribute('data-kind')).toBe('success');
      expect(banner?.getAttribute('role')).toBe('status');

      banner!.querySelector<HTMLButtonElement>('button')!.click();
      await settle();
      expect(el().querySelector('app-notice .banner')).toBeNull();
    });

    it('marks an error notice as an alert', async () => {
      TestBed.inject(NotificationService).error('It broke.');
      await settle();

      expect(el().querySelector('app-notice .banner')?.getAttribute('role')).toBe('alert');
    });

    it('confirms a Settings save with a banner that follows the user to the boards page', async () => {
      login();
      await go('/settings');

      submit(el().querySelector('.settings-form'));
      await waitFor(() => expect(router.url).toBe('/boards'));
      await settle();

      expect(text(el().querySelector('app-notice .banner'))).toContain('Settings saved.');
    });

    // Navigation happens under real timers; the fake clock is installed only around the save, so
    // the notice's auto-dismiss timer is the one thing the test controls.
    const saveSettingsUnderFakeTimers = async () => {
      jest.useFakeTimers();
      submit(el().querySelector('.settings-form'));
      await jest.advanceTimersByTimeAsync(50);
      fixture.detectChanges();
    };
    const banner = () => el().querySelector('app-notice .banner');

    it('keeps the Settings-save banner up past the auto-dismiss time once "keep messages" is on', async () => {
      login();
      await go('/settings');
      checkbox('Keep success messages').click();
      await settle();

      try {
        await saveSettingsUnderFakeTimers();
        expect(text(banner())).toContain('Settings saved.');

        await jest.advanceTimersByTimeAsync(60_000);
        fixture.detectChanges();

        expect(text(banner())).toContain('Settings saved.');
      } finally {
        jest.useRealTimers();
      }
    });

    it('auto-dismisses that same banner when "keep messages" is off', async () => {
      login();
      await go('/settings');

      try {
        await saveSettingsUnderFakeTimers();
        expect(banner()).not.toBeNull();

        await jest.advanceTimersByTimeAsync(3949); // 50ms already elapsed during the save: 3999ms in total;
        fixture.detectChanges();
        expect(banner()).not.toBeNull();

        await jest.advanceTimersByTimeAsync(1);
        fixture.detectChanges();
        expect(banner()).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('preferences shared between Settings and task pages', () => {
    it('lets a task be deleted without a prompt once Settings turns confirmation off', async () => {
      TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
      const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
      login();
      await go('/settings');
      checkbox('Ask for confirmation').click();
      await settle();
      submit(el().querySelector('.settings-form'));
      await waitFor(() => expect(router.url).toBe('/boards'));

      await go('/boards/roadmap/tasks/q1-goals');
      el().querySelector<HTMLButtonElement>('app-task-detail .btn-secondary')!.click();

      await waitFor(() => expect(router.url).toBe('/boards/roadmap'));
      expect(confirm).not.toHaveBeenCalled();
    });

    it('still asks for confirmation by default, and a refusal keeps the task', async () => {
      TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
      const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
      await go('/boards/roadmap/tasks/q1-goals');

      el().querySelector<HTMLButtonElement>('app-task-detail .btn-secondary')!.click();
      await settle();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(router.url).toBe('/boards/roadmap/tasks/q1-goals');
    });

    it('offers the boards that exist as choices for the default board', async () => {
      TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
      await go('/boards');
      await waitFor(() => expect(TestBed.inject(BoardService).loaded()).toBe(true));
      login();
      await go('/settings');

      el().querySelector<HTMLButtonElement>('.settings-form .select-trigger')!.click();
      fixture.detectChanges();
      const options = Array.from(el().querySelectorAll('.settings-form .select-option')).map((o) =>
        text(o),
      );

      expect(options[0]).toContain('None');
      expect(options.slice(1)).toEqual([...TestBed.inject(BoardService).boardIds()]);
    });
  });
});
