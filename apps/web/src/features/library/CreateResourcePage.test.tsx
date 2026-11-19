import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http } from 'msw';
import { server } from '../../test/mswServer';
import {
  apiError,
  coursesHandler,
  csrfTokenHandler,
  groupsHandler,
  meHandler,
  resourceCreateHandler,
} from '../../test/mswHandlers';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithProviders } from '../../test/renderWithProviders';
import { CreateResourcePage } from './CreateResourcePage';

function renderCreatePage() {
  return renderWithProviders(
    <Routes>
      <Route path="/library/new" element={<CreateResourcePage />} />
      <Route path="/library/:resourceId" element={<p>Resource detail stub</p>} />
    </Routes>,
    { route: '/library/new' },
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Title/), 'A New Article');
  await user.type(screen.getByLabelText(/^Description/), 'Describes something useful.');
  await user.type(screen.getByLabelText(/^Creator name/), 'Jane Doe');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateResourcePage', () => {
  it('creates a resource, shows a success toast, and navigates to its detail page', async () => {
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      coursesHandler([]),
      groupsHandler([]),
      resourceCreateHandler,
    );
    const user = userEvent.setup();
    renderCreatePage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    expect(await screen.findByText('Resource created')).toBeInTheDocument();
    expect(await screen.findByText('Resource detail stub')).toBeInTheDocument();
  });

  it('shows a server error and keeps the form in place when creation fails', async () => {
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      coursesHandler([]),
      groupsHandler([]),
      http.post('/api/v1/resources', () =>
        apiError(500, { error: { message: 'Internal error', code: 'INTERNAL_SERVER_ERROR' } }),
      ),
    );
    const user = userEvent.setup();
    renderCreatePage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Resource detail stub')).not.toBeInTheDocument());
  });
});
