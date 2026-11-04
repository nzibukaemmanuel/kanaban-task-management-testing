import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AddTask } from './add-task';
import { NotificationService } from '../../../core/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { TaskService } from '../task.service';
import { provideTaskStoreForTests } from '../store/testing';

describe('AddTask', () => {
  let fixture: ComponentFixture<AddTask>;
  let component: AddTask;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTask],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTask);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('boardId', 'roadmap');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has no unsaved changes until the form is edited', () => {
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  const value = {
    title: 'New task',
    description: 'Some details.',
    status: 'todo' as const,
    dueDate: '2026-09-01',
    subtasks: [],
  };

  it('creates the task on the server and navigates back to the board once it is saved', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const taskService = TestBed.inject(TaskService);

    component.onSave(value);

    await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(['/boards', 'roadmap']));
    const saved = await firstValueFrom(taskService.list('roadmap'));
    expect(saved.some((task) => task.title === 'New task')).toBe(true);
  });

  it('shows a success notice after saving', async () => {
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const notificationService = TestBed.inject(NotificationService);

    component.onSave(value);
    await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalled());

    expect(notificationService.notice()).toEqual({
      message: '"New task" was added.',
      kind: 'success',
    });
  });

  it('flags the form as saving while the request is in flight', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.onSave(value);
    expect(component.saving()).toBe(true);

    await vi.waitFor(() => expect(component.saving()).toBe(false));
  });

  it('stays on the form and shows the server error when saving fails', async () => {
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(TaskService), 'create').mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const notificationService = TestBed.inject(NotificationService);

    component.onSave(value);

    await vi.waitFor(() => expect(notificationService.notice()?.kind).toBe('error'));
    expect(notificationService.notice()?.message).toContain("Couldn't add the task");
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('navigates back to the board on cancel', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.onCancel();

    expect(navigateSpy).toHaveBeenCalledWith(['/boards', 'roadmap']);
  });
});
