import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { routes } from './routes';
import { NotFoundPage } from '../features/not-found/NotFoundPage';

// The live data router (createBrowserRouter) is exercised in the browser and
// in Playwright e2e, not here: under jsdom its eager `.initialize()` call
// constructs a Request whose AbortSignal fails an `instanceof` check against
// Node's undici implementation (a known jsdom/Node fetch-polyfill mismatch).
// These tests instead assert the route configuration shape and render each
// route's page component directly.

describe('route configuration', () => {
  it('defines an index route for the home page and a catch-all 404', () => {
    const [root] = routes;
    const children = root?.children ?? [];

    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ index: true });
    expect(children[1]).toMatchObject({ path: '*' });
  });
});

describe('page components', () => {
  it('renders the not found page with a link back home', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});
