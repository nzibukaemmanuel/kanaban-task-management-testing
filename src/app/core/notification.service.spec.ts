import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    vi.useFakeTimers();
    service.success('Task added.');
    expect(service.notice()).not.toBeNull();

    vi.advanceTimersByTime(4000);

    expect(service.notice()).toBeNull();
  });

  it('does not auto-dismiss an error notice', () => {
    vi.useFakeTimers();
    service.error('Something went wrong.');

    vi.advanceTimersByTime(10000);

    expect(service.notice()).not.toBeNull();
  });

  it("clears the previous notice's timer so it can't erase a newer notice early", () => {
    vi.useFakeTimers();
    service.success('First.');
    vi.advanceTimersByTime(3000);
    service.success('Second.');
    vi.advanceTimersByTime(3000); // 6000ms since "First.", but only 3000ms since "Second."

    expect(service.notice()?.message).toBe('Second.');
  });

  it('does not auto-dismiss a success notice once persistSuccess is enabled', () => {
    vi.useFakeTimers();
    service.setPersistSuccess(true);

    service.success('Task added.');
    vi.advanceTimersByTime(10000);

    expect(service.notice()).not.toBeNull();
  });
});
