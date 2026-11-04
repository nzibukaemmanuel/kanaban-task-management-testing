import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { NotificationService } from '../../../core/notification.service';
import { BoardService } from '../board.service';
import { Boards } from './boards';
import { TaskActions } from '../store/task.actions';
import { loadBoardsForTests, provideTaskStoreForTests } from '../store/testing';

describe('Boards', () => {
  let component: Boards;
  let fixture: ComponentFixture<Boards>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Boards],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    }).compileComponents();

    fixture = TestBed.createComponent(Boards);
    component = fixture.componentInstance;
    await loadBoardsForTests();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('navigates to the selected board when jumping via the quick-jump select', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.jumpToBoard('roadmap');

    expect(navigateSpy).toHaveBeenCalledWith(['/boards', 'roadmap']);
  });

  it('does not navigate when no board is selected', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.jumpToBoard('');

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('streams the current task count for a board', async () => {
    expect(await firstValueFrom(component.taskCount$('roadmap'))).toBe(4);
  });

  it('reflects a task added via the store — through the Add Task effect — without a reload', async () => {
    const store = TestBed.inject(Store);
    const before = await firstValueFrom(component.taskCount$('roadmap'));

    store.dispatch(
      TaskActions.addTask({
        boardId: 'roadmap',
        task: { title: 'New task', description: '', status: 'todo', dueDate: '', subtasks: [] },
      }),
    );

    await vi.waitFor(async () =>
      expect(await firstValueFrom(component.taskCount$('roadmap'))).toBe(before + 1),
    );
  });
});

describe('Boards loading and error states', () => {
  afterEach(() => localStorage.removeItem('kanban-mock-api-fail'));

  const render = () => {
    TestBed.configureTestingModule({
      imports: [Boards],
      providers: [provideRouter([]), provideTaskStoreForTests({ seeded: false })],
    });
    const fixture = TestBed.createComponent(Boards);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: ComponentFixture<Boards>) =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('shows a loading indicator until the data arrives, then the board list', async () => {
    const fixture = render();
    expect(text(fixture)).toContain('Loading boards');
    expect(text(fixture)).not.toContain('Select a board');

    TestBed.inject(Store).dispatch(TaskActions.loadTasks());
    TestBed.inject(BoardService).load();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(text(fixture)).toContain('Select a board to view its details.');
    });
    expect(text(fixture)).not.toContain('Loading boards');
    expect(text(fixture)).toContain('roadmap');
  });

  it('shows the error with a retry that recovers once the server is back', async () => {
    localStorage.setItem('kanban-mock-api-fail', 'true');
    const fixture = render();
    TestBed.inject(BoardService).load();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(text(fixture)).toContain("Couldn't load boards");
    });

    localStorage.removeItem('kanban-mock-api-fail');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.data-state button')
      ?.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(text(fixture)).toContain('Select a board to view its details.');
    });
  });
});

describe('Boards — creating a board', () => {
  let fixture: ComponentFixture<Boards>;
  let component: Boards;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Boards],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    });
    TestBed.inject(AuthService).login('MANNAZ', 'NZIBUKA123');
    fixture = TestBed.createComponent(Boards);
    component = fixture.componentInstance;
    await loadBoardsForTests();
    fixture.detectChanges();
  });

  const el = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector);

  it('shows the add-board form only to a logged-in user', () => {
    expect(el('form.new-board')).not.toBeNull();

    TestBed.inject(AuthService).logout();
    fixture.detectChanges();

    expect(el('form.new-board')).toBeNull();
  });

  it('creates the board with a slugged id through the API and tells the user', async () => {
    component.newBoardForm.controls.name.setValue('Q4 Launch!');

    component.createBoard();
    expect(component.creating()).toBe(true);

    await vi.waitFor(() =>
      expect(TestBed.inject(BoardService).boardExists('q4-launch')).toBe(true),
    );
    expect(TestBed.inject(NotificationService).notice()).toEqual({
      message: 'Board "q4-launch" was created.',
      kind: 'success',
    });
    expect(component.creating()).toBe(false);
    expect(component.newBoardForm.controls.name.value).toBe('');
  });

  it('rejects an empty name, an unusable name and a name that matches an existing board', () => {
    const name = component.newBoardForm.controls.name;

    name.setValue('');
    expect(name.hasError('required')).toBe(true);
    name.setValue('!!!');
    expect(name.hasError('unusableName')).toBe(true);
    name.setValue(' RoadMap ');
    expect(name.hasError('duplicateBoard')).toBe(true);
    name.setValue('x'.repeat(41));
    expect(name.hasError('maxlength')).toBe(true);
  });

  it('does not call the API for an invalid name', () => {
    const create = vi.spyOn(TestBed.inject(BoardService), 'create');
    component.newBoardForm.controls.name.setValue('roadmap');

    component.createBoard();

    expect(create).not.toHaveBeenCalled();
    expect(component.newBoardForm.controls.name.touched).toBe(true);
  });

  it('shows the server message and keeps the typed name when creation fails', async () => {
    vi.spyOn(TestBed.inject(BoardService), 'create').mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    component.newBoardForm.controls.name.setValue('Fresh board');

    component.createBoard();

    await vi.waitFor(() =>
      expect(TestBed.inject(NotificationService).notice()?.kind).toBe('error'),
    );
    expect(component.creating()).toBe(false);
    expect(component.newBoardForm.controls.name.value).toBe('Fresh board');
  });
});
