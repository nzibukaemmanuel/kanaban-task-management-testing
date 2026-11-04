import { authGuard } from '../../core/auth.guard';
import { unsavedChangesGuard } from '../../core/unsaved-changes.guard';
import { BOARD_ROUTES } from './board.routes';

describe('BOARD_ROUTES', () => {
  it('leaves the boards list open to everyone', () => {
    const boardsList = BOARD_ROUTES.find((route) => route.path === '');

    expect(boardsList?.canActivate).toBeUndefined();
  });

  it('requires authentication to view a specific board (and its nested task routes)', () => {
    const boardDetails = BOARD_ROUTES.find((route) => route.path === ':boardId');

    expect(boardDetails?.canActivate).toEqual([authGuard]);
    expect(boardDetails?.children?.some((child) => child.path === 'tasks/:taskId')).toBe(true);
  });

  it('guards the add-task and edit-task routes against navigating away with unsaved changes', () => {
    const boardDetails = BOARD_ROUTES.find((route) => route.path === ':boardId');
    const newTask = boardDetails?.children?.find((child) => child.path === 'new-task');
    const editTask = boardDetails?.children?.find((child) => child.path === 'tasks/:taskId/edit');

    expect(newTask?.canDeactivate).toEqual([unsavedChangesGuard]);
    expect(editTask?.canDeactivate).toEqual([unsavedChangesGuard]);
  });
});
