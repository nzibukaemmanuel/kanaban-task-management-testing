import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth.guard';
import { unsavedChangesGuard } from '../../core/unsaved-changes.guard';
import { AddTask } from './add-task/add-task';
import { Boards } from './boards/boards';
import { BoardDetails } from './board-details/board-details';
import { EditTask } from './edit-task/edit-task';
import { TaskDetail } from './task-detail/task-detail';

export const BOARD_ROUTES: Routes = [
  // The boards list (/boards) is the only page open to everyone. Everything past it —
  // a specific board and its tasks — requires login; canActivate on this segment also
  // covers every nested route (new-task, tasks/:taskId, tasks/:taskId/edit), since a
  // child can't activate without its parent.
  { path: '', component: Boards },
  {
    path: ':boardId',
    component: BoardDetails,
    canActivate: [authGuard],
    children: [
      { path: 'new-task', component: AddTask, canDeactivate: [unsavedChangesGuard] },
      { path: 'tasks/:taskId', component: TaskDetail },
      { path: 'tasks/:taskId/edit', component: EditTask, canDeactivate: [unsavedChangesGuard] },
    ],
  },
];
