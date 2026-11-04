import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  function mockPrefersDark(matches: boolean): void {
    // window.matchMedia lives on the prototype chain in jsdom, not as an own property, so
    // vi.spyOn(window, 'matchMedia') can't find it to spy on — defineProperty works around that.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches } as MediaQueryList),
    });
  }

  it('defaults to light when nothing is stored and the OS prefers light', () => {
    mockPrefersDark(false);

    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('defaults to dark when nothing is stored and the OS prefers dark', () => {
    mockPrefersDark(true);

    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it("prefers a previously-saved choice over the OS setting", () => {
    localStorage.setItem('kanban-theme', 'dark');
    mockPrefersDark(false); // OS says light, but the user had already chosen dark

    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.theme()).toBe('dark');
  });

  it('toggle() flips between light and dark, persisting the choice', () => {
    mockPrefersDark(false);
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    service.toggle();
    TestBed.tick();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('kanban-theme')).toBe('dark');

    service.toggle();
    TestBed.tick();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('kanban-theme')).toBe('light');
  });

  it('setTheme() sets an explicit theme regardless of the current one', () => {
    mockPrefersDark(false);
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    service.setTheme('dark');
    TestBed.tick();
    expect(service.theme()).toBe('dark');

    service.setTheme('dark'); // idempotent — setting the same theme again is a no-op, not an error
    TestBed.tick();
    expect(service.theme()).toBe('dark');
  });
});
