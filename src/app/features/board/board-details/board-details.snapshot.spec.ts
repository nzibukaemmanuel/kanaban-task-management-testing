import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideRouter } from '@angular/router';
import { BoardService } from '../board.service';
import { loadBoardsForTests, provideTaskStoreForTests } from '../store/testing';
import { BoardDetails } from './board-details';

// Only the columns are snapshotted, not the whole page: the toolbar contains SelectFields whose
// generated ids depend on how many were created earlier in the run, which would make the
// snapshot depend on test order.
describe('BoardDetails columns (snapshots)', () => {
  async function renderColumns(inputs: Record<string, unknown>, prepare?: () => Promise<unknown>) {
    TestBed.configureTestingModule({
      imports: [BoardDetails],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    });
    const fixture = TestBed.createComponent(BoardDetails);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await loadBoardsForTests();
    await prepare?.();
    fixture.detectChanges();
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('.board-columns');
  }

  it('renders all three columns of a populated board', async () => {
    expect(await renderColumns({ boardId: 'platform-launch' })).toMatchSnapshot();
  });

  it('renders a single column when a status filter is set', async () => {
    expect(await renderColumns({ boardId: 'platform-launch', status: 'doing' })).toMatchSnapshot();
  });

  it('renders three empty columns for a board with no tasks', async () => {
    const columns = await renderColumns({ boardId: 'empty-board' }, () =>
      firstValueFrom(TestBed.inject(BoardService).create('empty-board')),
    );

    expect(columns).toMatchSnapshot();
  });
});
