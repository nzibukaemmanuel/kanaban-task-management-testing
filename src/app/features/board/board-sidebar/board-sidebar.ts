import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BoardService } from '../board.service';

// Shared between Boards and BoardDetails so both routes present the same "all boards" nav
// instead of each owning a copy of the list markup.
@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-board-sidebar',
  styleUrl: './board-sidebar.css',
  templateUrl: './board-sidebar.html',
})
export class BoardSidebar {
  private readonly boardService = inject(BoardService);

  readonly boardIds = this.boardService.boardIds;
  readonly collapsed = signal(false);

  toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }
}
