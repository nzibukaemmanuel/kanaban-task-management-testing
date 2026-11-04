import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '../../core/notification.service';
import { Notice } from './notice';

describe('Notice', () => {
  let fixture: ComponentFixture<Notice>;
  let notificationService: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notice],
    }).compileComponents();

    fixture = TestBed.createComponent(Notice);
    notificationService = TestBed.inject(NotificationService);
    fixture.detectChanges();
  });

  it('renders nothing when there is no notice', () => {
    expect(fixture.nativeElement.querySelector('.banner')).toBeNull();
  });

  it('renders a success notice with role="status"', () => {
    notificationService.success('Task added.');
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.banner');
    expect(banner.textContent).toContain('Task added.');
    expect(banner.getAttribute('data-kind')).toBe('success');
    expect(banner.getAttribute('role')).toBe('status');
  });

  it('renders an error notice with role="alert"', () => {
    notificationService.error('Something broke.');
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.banner');
    expect(banner.getAttribute('data-kind')).toBe('error');
    expect(banner.getAttribute('role')).toBe('alert');
  });

  it('dismisses the notice when the dismiss button is clicked', () => {
    notificationService.success('Task added.');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.banner button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.banner')).toBeNull();
  });
});
