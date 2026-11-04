import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { waitFor } from '../../../../testing/wait-for';
import { BoardService } from '../board.service';
import { loadBoardsForTests, provideTaskStoreForTests } from '../store/testing';
import { BoardSidebar } from './board-sidebar';

@Component({ template: '' })
class BlankPage {}

describe('BoardSidebar', () => {
  let fixture: ComponentFixture<BoardSidebar>;
  let component: BoardSidebar;

  const el = () => fixture.nativeElement as HTMLElement;
  const links = () => Array.from(el().querySelectorAll<HTMLAnchorElement>('.board-sidebar__link'));
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardSidebar],
      providers: [
        provideRouter([{ path: 'boards/:boardId', component: BlankPage }]),
        provideTaskStoreForTests(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardSidebar);
    component = fixture.componentInstance;
  });

  it('initialises expanded', () => {
    expect(component.collapsed()).toBe(false);
  });

  it('shows an empty list with a zero count before any boards have loaded', async () => {
    await render();

    expect(el().querySelector('.board-sidebar__heading')?.textContent).toContain('All boards (0)');
    expect(links()).toEqual([]);
  });

  describe('once boards have loaded', () => {
    beforeEach(async () => {
      await loadBoardsForTests();
      await render();
    });

    it('exposes the shared board list from BoardService', () => {
      expect(component.boardIds()).toBe(TestBed.inject(BoardService).boardIds());
    });

    it('renders one link per board, labelled with its id', () => {
      expect(links().map((link) => link.textContent?.trim())).toEqual([
        'platform-launch',
        'marketing-plan',
        'roadmap',
      ]);
    });

    it('points each link at its board route', () => {
      expect(links().map((link) => link.getAttribute('href'))).toEqual([
        '/boards/platform-launch',
        '/boards/marketing-plan',
        '/boards/roadmap',
      ]);
    });

    it('shows the board count in the heading', () => {
      expect(el().querySelector('.board-sidebar__heading')?.textContent).toContain(
        'All boards (3)',
      );
    });

    it('exposes the list as a labelled navigation landmark', () => {
      expect(el().querySelector('nav')?.getAttribute('aria-label')).toBe('Boards');
    });

    it('marks only the link of the current board as active', async () => {
      await TestBed.inject(Router).navigateByUrl('/boards/roadmap');
      await render();

      const active = links().filter((link) =>
        link.classList.contains('board-sidebar__link--active'),
      );
      expect(active.map((link) => link.textContent?.trim())).toEqual(['roadmap']);
    });

    it('picks up a board created later without being re-created', async () => {
      TestBed.inject(BoardService).create('sandbox').subscribe();
      await waitFor(() =>
        expect(TestBed.inject(BoardService).boardIds()).toContain('sandbox'),
      );
      await render();

      expect(links().map((link) => link.textContent?.trim())).toContain('sandbox');
      expect(el().querySelector('.board-sidebar__heading')?.textContent).toContain(
        'All boards (4)',
      );
    });
  });

  describe('collapsing', () => {
    const toggle = () => el().querySelector<HTMLButtonElement>('.board-sidebar__toggle')!;
    const showButton = () => el().querySelector<HTMLButtonElement>('.board-sidebar__show');

    beforeEach(render);

    it('starts without the collapsed class and without the floating show button', () => {
      expect(el().querySelector('.board-sidebar--collapsed')).toBeNull();
      expect(showButton()).toBeNull();
    });

    it('collapses when "Hide sidebar" is clicked and reveals a labelled show button', async () => {
      toggle().click();
      await render();

      expect(component.collapsed()).toBe(true);
      expect(el().querySelector('.board-sidebar--collapsed')).not.toBeNull();
      expect(showButton()?.getAttribute('aria-label')).toBe('Show sidebar');
    });

    it('expands again from the floating show button', async () => {
      toggle().click();
      await render();

      showButton()!.click();
      await render();

      expect(component.collapsed()).toBe(false);
      expect(el().querySelector('.board-sidebar--collapsed')).toBeNull();
      expect(showButton()).toBeNull();
    });

    it('toggleCollapsed flips the state each time it is called', () => {
      component.toggleCollapsed();
      expect(component.collapsed()).toBe(true);
      component.toggleCollapsed();
      expect(component.collapsed()).toBe(false);
    });
  });

});
