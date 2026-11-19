import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Spinner } from '../../shared/ui/Spinner';
import styles from './FullPageState.module.css';

/** A centered, full-viewport loading state — shown while
 * `useCurrentUser()` resolves, so a protected route never renders its
 * real content (or redirects away) before the session check actually
 * completes (see RequireAuth.tsx). */
export function FullPageSpinner() {
  return (
    <div className={styles.container}>
      <Spinner size="lg" label="Checking your session…" />
    </div>
  );
}

export interface FullPageMessageProps {
  icon?: ReactNode;
  title: string;
  message: string;
}

/** The shared "whole page is this one state" layout for authorization
 * outcomes other than loading — e.g. `RequireRole`'s 403. Deliberately
 * not `RouteErrorFallback`: that component renders for a thrown
 * loader/render error (`useRouteError`), not an ordinary, expected
 * authorization outcome. */
export function FullPageMessage({ icon, title, message }: FullPageMessageProps) {
  return (
    <div className={styles.container} role="alert">
      {icon ?? <ShieldAlert className={styles.icon} aria-hidden="true" />}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
