import { Routes } from '@angular/router';
import { Settings } from './pages/settings/settings';
import { NotFound } from './pages/not-found/not-found';
import { TipsPanel } from './pages/tips-panel/tips-panel';
import { Login } from './pages/login/login';
import { authGuard } from './core/auth.guard';
import { unsavedChangesGuard } from './core/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'boards', pathMatch: 'full' },
  {
    path: 'boards',
    loadChildren: () => import('./features/board/board.routes').then((m) => m.BOARD_ROUTES),
  },
  { path: 'login', component: Login },
  {
    path: 'settings',
    component: Settings,
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  { path: 'tips', component: TipsPanel, outlet: 'aux', canActivate: [authGuard] },
  // Deliberately left open: an unauthenticated visitor hitting a broken/mistyped link should
  // see a real "not found," not get bounced to login as if the page were merely restricted.
  { path: '**', component: NotFound },
];
