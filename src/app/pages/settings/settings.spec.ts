import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BoardService } from '../../features/board/board.service';
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
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

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
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[formcontrolname="displayName"]');
    input.value = 'Grace';
    input.dispatchEvent(new Event('input'));
    expect(component.hasUnsavedChanges()).toBe(true);

    component.save();

    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('applies the chosen theme to ThemeService on save', () => {
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const themeService = TestBed.inject(ThemeService);

    component.form.controls.theme.setValue('dark');
    component.save();

    expect(themeService.theme()).toBe('dark');
  });

  it('applies confirmBeforeDelete and defaultBoardId to PreferencesService on save', () => {
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const preferencesService = TestBed.inject(PreferencesService);

    component.form.controls.confirmBeforeDelete.setValue(false);
    component.setDefaultBoardId('roadmap');
    component.save();

    expect(preferencesService.confirmBeforeDelete()).toBe(false);
    expect(preferencesService.defaultBoardId()).toBe('roadmap');
  });

  it('applies persistSuccessNotices to NotificationService on save', () => {
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const notificationService = TestBed.inject(NotificationService);

    component.form.controls.persistSuccessNotices.setValue(true);
    component.save();

    expect(notificationService.persistSuccess()).toBe(true);
  });
});

describe('Settings — staying in sync with the services', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [provideRouter([])],
    }).compileComponents();
    // save() navigates to /boards, which this empty test router has no route for.
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  const sync = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  describe('an untouched field follows the service', () => {
    it('theme', async () => {
      TestBed.inject(ThemeService).setTheme('dark');
      await sync();

      expect(component.form.controls.theme.value).toBe('dark');
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('confirmBeforeDelete', async () => {
      TestBed.inject(PreferencesService).setConfirmBeforeDelete(false);
      await sync();

      expect(component.form.controls.confirmBeforeDelete.value).toBe(false);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('persistSuccessNotices', async () => {
      TestBed.inject(NotificationService).setPersistSuccess(true);
      await sync();

      expect(component.form.controls.persistSuccessNotices.value).toBe(true);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('defaultBoardId', async () => {
      TestBed.inject(PreferencesService).setDefaultBoardId('roadmap');
      await sync();

      expect(component.form.controls.defaultBoardId.value).toBe('roadmap');
      expect(component.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('a field the user has edited is not overwritten', () => {
    it('theme', async () => {
      component.form.controls.theme.setValue('dark');
      component.form.controls.theme.markAsDirty();

      TestBed.inject(ThemeService).setTheme('light');
      await sync();

      expect(component.form.controls.theme.value).toBe('dark');
    });

    it('confirmBeforeDelete', async () => {
      component.form.controls.confirmBeforeDelete.setValue(false);
      component.form.controls.confirmBeforeDelete.markAsDirty();

      TestBed.inject(PreferencesService).setConfirmBeforeDelete(true);
      await sync();

      expect(component.form.controls.confirmBeforeDelete.value).toBe(false);
    });

    it('persistSuccessNotices', async () => {
      component.form.controls.persistSuccessNotices.setValue(true);
      component.form.controls.persistSuccessNotices.markAsDirty();

      TestBed.inject(NotificationService).setPersistSuccess(false);
      await sync();

      expect(component.form.controls.persistSuccessNotices.value).toBe(true);
    });

    it('defaultBoardId', async () => {
      component.setDefaultBoardId('platform-launch');

      TestBed.inject(PreferencesService).setDefaultBoardId('roadmap');
      await sync();

      expect(component.form.controls.defaultBoardId.value).toBe('platform-launch');
    });
  });

  describe('setDefaultBoardId', () => {
    it('updates the form and marks the form as having unsaved changes', () => {
      component.setDefaultBoardId('roadmap');

      expect(component.form.controls.defaultBoardId.value).toBe('roadmap');
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('does not touch PreferencesService until the form is saved', () => {
      component.setDefaultBoardId('roadmap');

      expect(TestBed.inject(PreferencesService).defaultBoardId()).toBe('');

      component.save();

      expect(TestBed.inject(PreferencesService).defaultBoardId()).toBe('roadmap');
    });
  });

  it('shows the unsaved-changes hint only while the form is dirty', async () => {
    expect(fixture.nativeElement.querySelector('.unsaved-hint')).toBeNull();

    component.setDefaultBoardId('roadmap');
    await sync();
    expect(fixture.nativeElement.querySelector('.unsaved-hint')).not.toBeNull();

    component.save();
    await sync();
    expect(fixture.nativeElement.querySelector('.unsaved-hint')).toBeNull();
  });

  it('offers "None" first, then one option per board the service knows', async () => {
    const options = (component as unknown as { boardOptions(): { value: string }[] }).boardOptions();

    expect(options[0]).toEqual({ value: '', label: 'None — go to Settings after login' });
    expect(options.slice(1).map((o) => o.value)).toEqual([...TestBed.inject(BoardService).boardIds()]);
  });

  it('tells the user the settings were saved', () => {
    component.save();

    expect(TestBed.inject(NotificationService).notice()).toEqual({
      message: 'Settings saved.',
      kind: 'success',
    });
  });
});
