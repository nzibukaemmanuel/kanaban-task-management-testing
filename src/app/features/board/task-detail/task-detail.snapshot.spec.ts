import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { TaskActions } from '../store/task.actions';
import { fixtureTaskValue, provideTaskStoreForTests } from '../store/testing';
import { waitFor } from '../../../../testing/wait-for';
import { TaskDetail } from './task-detail';

describe('TaskDetail (snapshots)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TaskDetail],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    });
  });

  async function render(boardId: string, taskId: string) {
    const fixture = TestBed.createComponent(TaskDetail);
    fixture.componentRef.setInput('boardId', boardId);
    fixture.componentRef.setInput('taskId', taskId);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('renders a task with a description, due date and subtasks', async () => {
    const fixture = await render('roadmap', 'q1-goals');

    expect(fixture.nativeElement).toMatchSnapshot();
  });

  it('renders a bare task: no description, due date or subtasks', async () => {
    const fixture = await render('roadmap', 'q1-goals');
    TestBed.inject(Store).dispatch(
      TaskActions.updateTask({
        boardId: 'roadmap',
        taskId: 'q1-goals',
        task: fixtureTaskValue('roadmap', 'q1-goals', {
          description: '',
          dueDate: '',
          subtasks: [],
          status: 'done',
        }),
      }),
    );
    await waitFor(() => expect(fixture.componentInstance.task()?.status).toBe('done'));
    fixture.detectChanges();

    expect(fixture.nativeElement).toMatchSnapshot();
  });

  it('renders the not-found state', async () => {
    const fixture = await render('roadmap', 'ghost');

    expect(fixture.nativeElement).toMatchSnapshot();
  });
});
