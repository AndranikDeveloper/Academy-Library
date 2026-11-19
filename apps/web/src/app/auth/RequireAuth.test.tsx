import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Outlet, Route, Routes } from 'react-router-dom';
import { server } from '../../test/mswServer';
import { MOCK_STUDENT_USER } from '../../test/authFixtures';
import { csrfTokenHandler, meHandler } from '../../test/mswHandlers';
import { renderWithProviders } from '../../test/renderWithProviders';
import { RequireAuth } from './RequireAuth';

function renderProtected(route = '/dashboard') {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<div>Login page</div>} />
      <Route element={<RequireAuth />}>
        <Route element={<Outlet />}>
          <Route path="/dashboard" element={<div>Protected dashboard</div>} />
        </Route>
      </Route>
    </Routes>,
    { route },
  );
}

describe('RequireAuth', () => {
  it('shows a loading state before the session check resolves, never the protected content', () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER));
    renderProtected();

    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the protected content once an active session is confirmed', async () => {
    server.use(csrfTokenHandler, meHandler(MOCK_STUDENT_USER));
    renderProtected();

    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument();
  });

  it('redirects an anonymous visitor to /login, preserving the destination in ?from=', async () => {
    server.use(csrfTokenHandler, meHandler(null));
    renderProtected('/dashboard');

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('redirects to /login when the session check itself errors (fail closed)', async () => {
    server.use(
      csrfTokenHandler,
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json(
          { error: { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' } },
          { status: 500 },
        ),
      ),
    );
    renderProtected();

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
