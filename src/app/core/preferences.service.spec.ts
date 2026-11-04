import { TestBed } from '@angular/core/testing';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults confirmBeforeDelete to true when nothing is stored', () => {
    const service = TestBed.inject(PreferencesService);
    TestBed.tick();

    expect(service.confirmBeforeDelete()).toBe(true);
  });

  it('defaults defaultBoardId to an empty string when nothing is stored', () => {
    const service = TestBed.inject(PreferencesService);
    TestBed.tick();

    expect(service.defaultBoardId()).toBe('');
  });

  it('setConfirmBeforeDelete() persists the choice', () => {
    const service = TestBed.inject(PreferencesService);
    TestBed.tick();

    service.setConfirmBeforeDelete(false);
    TestBed.tick();

    expect(service.confirmBeforeDelete()).toBe(false);
    expect(localStorage.getItem('kanban-confirm-before-delete')).toBe('false');
  });

  it('setDefaultBoardId() persists the choice', () => {
    const service = TestBed.inject(PreferencesService);
    TestBed.tick();

    service.setDefaultBoardId('roadmap');
    TestBed.tick();

    expect(service.defaultBoardId()).toBe('roadmap');
    expect(localStorage.getItem('kanban-default-board')).toBe('roadmap');
  });

  it('reads a previously-saved confirmBeforeDelete choice of false', () => {
    localStorage.setItem('kanban-confirm-before-delete', 'false');

    const service = TestBed.inject(PreferencesService);
    TestBed.tick();

    expect(service.confirmBeforeDelete()).toBe(false);
  });
});
