import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { loadBoardsForTests, provideTaskStoreForTests } from '../store/testing';
import { BoardSidebar } from './board-sidebar';

describe('BoardSidebar (snapshots)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoardSidebar],
      providers: [provideRouter([]), provideTaskStoreForTests()],
    });
  });

  it('renders the boards list, expanded', async () => {
    const fixture = TestBed.createComponent(BoardSidebar);
    await loadBoardsForTests();
    fixture.detectChanges();

    expect(fixture.nativeElement).toMatchSnapshot();
  });

  it('renders the collapsed state with its floating "show" button', async () => {
    const fixture = TestBed.createComponent(BoardSidebar);
    await loadBoardsForTests();
    fixture.componentInstance.toggleCollapsed();
    fixture.detectChanges();

    expect(fixture.nativeElement).toMatchSnapshot();
  });
});
