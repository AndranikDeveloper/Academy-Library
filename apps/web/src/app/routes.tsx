import type { RouteObject } from 'react-router-dom';
import { RootLayout } from './RootLayout';
import { RouteErrorFallback } from './RouteErrorFallback';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        index: true,
        lazy: () => import('../features/home/HomePage').then((m) => ({ Component: m.HomePage })),
      },
      {
        path: '*',
        lazy: () =>
          import('../features/not-found/NotFoundPage').then((m) => ({
            Component: m.NotFoundPage,
          })),
      },
    ],
  },
  // Dev-only component gallery. Guarded by a statically-replaced constant
  // so the route (and its whole chunk) is dead-code-eliminated from
  // production builds, not just hidden behind a runtime check.
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/design-system',
          lazy: () =>
            import('../features/dev-design-system/DesignSystemPage').then((m) => ({
              Component: m.DesignSystemPage,
            })),
        },
      ]
    : []),
];
