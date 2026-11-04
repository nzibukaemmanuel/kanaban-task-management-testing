import { TestBed } from '@angular/core/testing';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  provideRouter,
} from '@angular/router';
import { App } from './app';
import { provideTaskStoreForTests } from './features/board/store/testing';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('exposes ThemeService so the template can render/toggle the current theme', () => {
    const app = TestBed.createComponent(App).componentInstance as any;

    const before = app.themeService.theme();
    app.themeService.toggle();

    expect(app.themeService.theme()).not.toBe(before);
  });

  it('shows a loading state on NavigationStart and clears it on NavigationEnd', () => {
    const app = TestBed.createComponent(App).componentInstance as any;

    app.onRouterEvent(new NavigationStart(1, '/settings'));
    expect(app.isNavigating()).toBe(true);

    app.onRouterEvent(new NavigationEnd(1, '/settings', '/settings'));
    expect(app.isNavigating()).toBe(false);
  });

  it('clears the loading state on a cancelled navigation', () => {
    const app = TestBed.createComponent(App).componentInstance as any;

    app.onRouterEvent(new NavigationStart(1, '/settings'));
    app.onRouterEvent(new NavigationCancel(1, '/settings', 'guard rejected'));
    expect(app.isNavigating()).toBe(false);
  });

  it('surfaces a message and clears loading on NavigationError', () => {
    const app = TestBed.createComponent(App).componentInstance as any;

    app.onRouterEvent(new NavigationStart(1, '/settings'));
    app.onRouterEvent(new NavigationError(1, '/settings', new Error('boom'), undefined));

    expect(app.isNavigating()).toBe(false);
    expect(app.navigationError()).toContain('went wrong');
  });

  it('dismissError clears the navigation error', () => {
    const app = TestBed.createComponent(App).componentInstance as any;

    app.onRouterEvent(new NavigationError(1, '/settings', new Error('boom'), undefined));
    expect(app.navigationError()).not.toBeNull();

    app.dismissError();
    expect(app.navigationError()).toBeNull();
  });
});
