import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'kanban-theme';

// Applies the theme by stamping data-theme on <html>, which styles.css keys its dark-mode
// overrides off of — that's the only coupling between this service and the stylesheet.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly current = signal<Theme>(this.resolveInitialTheme());
  readonly theme = this.current.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.current();
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(STORAGE_KEY, theme);
    });
  }

  toggle(): void {
    this.current.set(this.current() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.current.set(theme);
  }

  // A returning visitor's explicit choice always wins; a first-time visitor gets whatever
  // their OS is already set to, rather than defaulting to light regardless of their system.
  private resolveInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // matchMedia is universal in real browsers, but guarded here since some embedded/sandboxed
    // contexts (and test environments) don't implement it — falling back to light rather than
    // throwing.
    const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
}
