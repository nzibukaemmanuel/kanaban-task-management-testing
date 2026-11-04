import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotificationService } from '../../core/notification.service';
import { PreferencesService } from '../../core/preferences.service';
import { ThemeService } from '../../core/theme.service';
import { Settings } from './settings';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('navigates back to /boards on save', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.save();

    expect(navigateSpy).toHaveBeenCalledWith(['/boards']);
  });

  it('has no unsaved changes until a field is edited', () => {
    expect(component.hasUnsavedChanges()).toBe(false);

    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[formcontrolname="displayName"]');
    input.value = 'Grace';
    input.dispatchEvent(new Event('input'));

    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('clears the unsaved-changes flag on save', () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[formcontrolname="displayName"]');
    input.value = 'Grace';
    input.dispatchEvent(new Event('input'));
    expect(component.hasUnsavedChanges()).toBe(true);

    component.save();

    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('applies the chosen theme to ThemeService on save', () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const themeService = TestBed.inject(ThemeService);

    component.form.controls.theme.setValue('dark');
    component.save();

    expect(themeService.theme()).toBe('dark');
  });

  it('applies confirmBeforeDelete and defaultBoardId to PreferencesService on save', () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const preferencesService = TestBed.inject(PreferencesService);

    component.form.controls.confirmBeforeDelete.setValue(false);
    component.setDefaultBoardId('roadmap');
    component.save();

    expect(preferencesService.confirmBeforeDelete()).toBe(false);
    expect(preferencesService.defaultBoardId()).toBe('roadmap');
  });

  it('applies persistSuccessNotices to NotificationService on save', () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const notificationService = TestBed.inject(NotificationService);

    component.form.controls.persistSuccessNotices.setValue(true);
    component.save();

    expect(notificationService.persistSuccess()).toBe(true);
  });
});
