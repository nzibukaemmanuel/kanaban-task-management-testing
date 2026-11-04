import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it('starts with no notice', () => {
    expect(service.notice()).toBeNull();
  });

  it('shows a success notice', () => {
    service.success('Task added.');

    expect(service.notice()).toEqual({ message: 'Task added.', kind: 'success' });
  });

  it('shows an error notice', () => {
    service.error('Something went wrong.');

    expect(service.notice()).toEqual({ message: 'Something went wrong.', kind: 'error' });
  });

  it('dismiss() clears the current notice', () => {
    service.success('Task added.');

    service.dismiss();

    expect(service.notice()).toBeNull();
  });

  it('auto-dismisses a success notice after a delay', () => {
    jest.useFakeTimers();
    service.success('Task added.');
    expect(service.notice()).not.toBeNull();

    jest.advanceTimersByTime(4000);

    expect(service.notice()).toBeNull();
  });

  it('does not auto-dismiss an error notice', () => {
    jest.useFakeTimers();
    service.error('Something went wrong.');

    jest.advanceTimersByTime(10000);

    expect(service.notice()).not.toBeNull();
  });

  it("clears the previous notice's timer so it can't erase a newer notice early", () => {
    jest.useFakeTimers();
    service.success('First.');
    jest.advanceTimersByTime(3000);
    service.success('Second.');
    jest.advanceTimersByTime(3000); // 6000ms since "First.", but only 3000ms since "Second."

    expect(service.notice()?.message).toBe('Second.');
  });

  it('does not auto-dismiss a success notice once persistSuccess is enabled', () => {
    jest.useFakeTimers();
    service.setPersistSuccess(true);

    service.success('Task added.');
    jest.advanceTimersByTime(10000);

    expect(service.notice()).not.toBeNull();
  });

  describe('auto-dismiss timing', () => {
    beforeEach(() => jest.useFakeTimers());

    it('keeps a success notice until the full delay has passed, then clears it', () => {
      service.success('Task added.');

      jest.advanceTimersByTime(3999);
      expect(service.notice()).not.toBeNull();

      jest.advanceTimersByTime(1);
      expect(service.notice()).toBeNull();
    });

    it('leaves no timer running once a success notice has been cleared', () => {
      service.success('Task added.');

      jest.advanceTimersByTime(4000);

      expect(jest.getTimerCount()).toBe(0);
    });

    it('cancels the pending timer when the notice is dismissed by hand', () => {
      service.success('Task added.');

      service.dismiss();

      expect(service.notice()).toBeNull();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('does not let an old success timer erase a newer notice after a manual dismiss', () => {
      service.success('First.');
      jest.advanceTimersByTime(2000);
      service.dismiss();
      service.success('Second.');

      jest.advanceTimersByTime(3000); // 5000ms after "First.", 3000ms after "Second."

      expect(service.notice()?.message).toBe('Second.');
    });

    it('keeps an error on screen when it replaces a success whose timer was running', () => {
      service.success('Saved.');
      jest.advanceTimersByTime(1000);
      service.error('Then it failed.');

      jest.advanceTimersByTime(10000);

      expect(service.notice()).toEqual({ message: 'Then it failed.', kind: 'error' });
    });

    it('starts a fresh countdown when a success replaces an error', () => {
      service.error('Failed.');
      jest.advanceTimersByTime(5000);
      service.success('Recovered.');

      jest.advanceTimersByTime(3999);
      expect(service.notice()?.message).toBe('Recovered.');

      jest.advanceTimersByTime(1);
      expect(service.notice()).toBeNull();
    });

    it('restarts the countdown for each new success rather than adding to it', () => {
      service.success('One.');
      jest.advanceTimersByTime(3000);
      service.success('Two.');

      jest.advanceTimersByTime(3999);
      expect(service.notice()?.message).toBe('Two.');

      jest.advanceTimersByTime(1);
      expect(service.notice()).toBeNull();
    });

    it('stops auto-dismissing new successes as soon as persistSuccess is switched on', () => {
      service.setPersistSuccess(true);
      service.success('Sticky.');

      jest.advanceTimersByTime(60_000);

      expect(service.notice()?.message).toBe('Sticky.');
      expect(jest.getTimerCount()).toBe(0);
    });

    it('resumes auto-dismissing when persistSuccess is switched back off', () => {
      service.setPersistSuccess(true);
      service.setPersistSuccess(false);
      service.success('Fleeting.');

      jest.advanceTimersByTime(4000);

      expect(service.notice()).toBeNull();
    });
  });

  describe('persistence of the persistSuccess preference', () => {
    it('writes the preference to localStorage once effects have run', () => {
      service.setPersistSuccess(true);
      TestBed.tick();

      expect(localStorage.getItem('kanban-persist-success-notices')).toBe('true');

      service.setPersistSuccess(false);
      TestBed.tick();

      expect(localStorage.getItem('kanban-persist-success-notices')).toBe('false');
    });

    it('restores the stored preference in a fresh service instance', () => {
      localStorage.setItem('kanban-persist-success-notices', 'true');
      TestBed.resetTestingModule();

      expect(TestBed.inject(NotificationService).persistSuccess()).toBe(true);
    });
  });
});
