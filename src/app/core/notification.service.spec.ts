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
});
