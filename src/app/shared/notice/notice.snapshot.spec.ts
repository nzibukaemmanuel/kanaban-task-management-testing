import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../core/notification.service';
import { Notice } from './notice';

describe('Notice (snapshots)', () => {
  function render(post?: (notifications: NotificationService) => void) {
    const fixture = TestBed.createComponent(Notice);
    if (post) {
      post(TestBed.inject(NotificationService));
    }
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => localStorage.clear());

  it('renders nothing when there is no notice', () => {
    expect(render().nativeElement).toMatchSnapshot();
  });

  it('renders a success notice as a polite status', () => {
    expect(render((n) => n.success('Task added.')).nativeElement).toMatchSnapshot();
  });

  it('renders an error notice as an alert', () => {
    expect(render((n) => n.error("Couldn't save the task.")).nativeElement).toMatchSnapshot();
  });
});
