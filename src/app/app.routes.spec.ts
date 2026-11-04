import { authGuard } from './core/auth.guard';
import { routes } from './app.routes';

describe('routes', () => {
  it('leaves login and the not-found fallback open to everyone', () => {
    const login = routes.find((route) => route.path === 'login');
    const notFound = routes.find((route) => route.path === '**');

    expect(login?.canActivate).toBeUndefined();
    expect(notFound?.canActivate).toBeUndefined();
  });

  it('requires authentication for settings and the tips panel', () => {
    const settings = routes.find((route) => route.path === 'settings');
    const tips = routes.find((route) => route.path === 'tips');

    expect(settings?.canActivate).toEqual([authGuard]);
    expect(tips?.canActivate).toEqual([authGuard]);
  });
});
