import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../features/auth/api/useCurrentUser';
import { FullPageSpinner } from './FullPageState';

/**
 * Gates the entire authenticated product shell (mounted as the parent
 * `element` of the `AppLayout` route branch — see `router/routes.tsx`).
 *
 * - While the session check is in flight, renders a full-page spinner,
 *   never `<Outlet/>` — this is what prevents a flash of protected
 *   content before `useCurrentUser()` has actually resolved.
 * - `data === null` (confirmed anonymous) *or* `isError` (the check
 *   itself failed) both redirect to `/login` — failing closed, not
 *   open, is the correct default for a route guard: if this app can't
 *   positively confirm who's signed in, it must not render the page as
 *   if someone is.
 * - The current location is preserved via `?from=`, consumed by
 *   `LoginPage` after a successful sign-in — see `safeRedirect.ts` for
 *   why that value is validated again on the way back out, not trusted
 *   just because this component is the one that set it.
 * - `replace` on the `<Navigate>` so the protected URL that triggered
 *   the redirect never ends up in browser history as its own entry
 *   (hitting "back" from `/login` would otherwise bounce right back to
 *   the page that just redirected away from itself).
 */
export function RequireAuth() {
  const { data: user, isLoading, isError } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!user || isError) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }

  return <Outlet />;
}
