import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import type { ResourceDetail } from '@academy-library/contracts';
import { resourceRepository } from '../../shared/data/resources';
import { server } from '../../test/mswServer';
import { csrfTokenHandler, meHandler, resourceDetailHandler } from '../../test/mswHandlers';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ResourceDetailsPage } from './ResourceDetailsPage';

const MANAGEABLE_RESOURCE: ResourceDetail = {
  id: 'res-managed',
  type: 'ARTICLE',
  title: 'A Manageable Article',
  description: 'Something.',
  difficulty: 'BEGINNER',
  creator: { name: 'Jane Doe' },
  coverImageUrl: null,
  sourceUrl: null,
  tags: [],
  courses: [],
  publishedAt: null,
  publisher: null,
  visibility: 'PUBLIC',
  restrictedToGroupIds: [],
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  capabilities: { canEdit: true, canDelete: true },
};

afterEach(() => {
  vi.restoreAllMocks();
});

function renderAt(resourceId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/library/:resourceId" element={<ResourceDetailsPage />} />
      <Route path="/library" element={<p>Library stub</p>} />
    </Routes>,
    { route: `/library/${resourceId}` },
  );
}

describe('ResourceDetailsPage', () => {
  it('renders title, type, difficulty, creator, description, courses, and tags for a known resource', async () => {
    server.use(meHandler(null), resourceDetailHandler);
    renderAt('res-001');

    expect(
      await screen.findByRole('heading', { name: 'Introduction to Algorithms' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('R. Kesari')).toBeInTheDocument();
    expect(screen.getByText(/standard reference on algorithms/)).toBeInTheDocument();
    expect(screen.getByText('Algorithms & Data Structures')).toBeInTheDocument();
    expect(screen.getByText('algorithms')).toBeInTheDocument();
  });

  it('shows duration for a VIDEO/RECORDING resource', async () => {
    server.use(meHandler(null), resourceDetailHandler);
    renderAt('res-021');

    expect(
      await screen.findByRole('heading', { name: 'Lecture: Linear Regression' }),
    ).toBeInTheDocument();
    expect(screen.getByText('47m')).toBeInTheDocument();
  });

  it('shows an "Open original resource" link only when a safe source URL exists', async () => {
    server.use(meHandler(null), resourceDetailHandler);
    renderAt('res-012');

    const link = await screen.findByRole('link', { name: 'Open original resource' });
    expect(link).toHaveAttribute('href', 'https://example.edu/articles/postgres-indexing');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('does not show an "Open original resource" link when there is no source URL', async () => {
    server.use(meHandler(null), resourceDetailHandler);
    renderAt('res-001');

    await screen.findByRole('heading', { name: 'Introduction to Algorithms' });
    expect(screen.queryByRole('link', { name: 'Open original resource' })).not.toBeInTheDocument();
  });

  it('shows a restricted-visibility note that does not reveal raw group identifiers', async () => {
    server.use(meHandler(null), resourceDetailHandler);
    renderAt('res-040');

    await screen.findByRole('heading', {
      name: 'Dataset: Open Course Enrollment Records (Anonymized)',
    });
    expect(screen.getByText(/restricted to specific groups/)).toBeInTheDocument();
    expect(screen.queryByText(/LECTURER/)).not.toBeInTheDocument();
  });

  it('shows a helpful not-found state for an unknown resource id, with a way back', async () => {
    server.use(meHandler(null), resourceDetailHandler);
    const user = userEvent.setup();
    renderAt('does-not-exist');

    expect(await screen.findByText('Resource not found')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to Explore Library' }));

    expect(await screen.findByText('Library stub')).toBeInTheDocument();
  });

  it('shows an error state with a working retry action', async () => {
    server.use(meHandler(null), resourceDetailHandler);
    const user = userEvent.setup();
    // `shouldRetryTransientFailure` retries a plain (non-`ApiError`)
    // failure twice before giving up — three rejections in a row to
    // actually exhaust that budget and reach the error state; the next
    // call (the "Try again" click) falls through to the real,
    // MSW-backed implementation.
    vi.spyOn(resourceRepository, 'getById')
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));

    renderAt('res-001');

    expect(await screen.findByText("Couldn't load this resource")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { name: 'Introduction to Algorithms' }),
    ).toBeInTheDocument();
  });

  it('shows Edit and Delete only when capabilities.canEdit/canDelete are true (Task 05C.3)', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
        HttpResponse.json(MANAGEABLE_RESOURCE),
      ),
    );
    renderAt(MANAGEABLE_RESOURCE.id);

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('deletes the resource after explicit confirmation and navigates back to the library', async () => {
    let deleteCalled = false;
    server.use(
      csrfTokenHandler,
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
        HttpResponse.json(MANAGEABLE_RESOURCE),
      ),
      http.delete(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAt(MANAGEABLE_RESOURCE.id);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/will be permanently deleted/)).toBeInTheDocument();
    expect(deleteCalled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Delete resource' }));

    expect(await screen.findByText('Resource deleted')).toBeInTheDocument();
    expect(deleteCalled).toBe(true);
    expect(await screen.findByText('Library stub')).toBeInTheDocument();
  });

  it('cancelling the delete dialog never calls the delete endpoint', async () => {
    let deleteCalled = false;
    server.use(
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
        HttpResponse.json(MANAGEABLE_RESOURCE),
      ),
      http.delete(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAt(MANAGEABLE_RESOURCE.id);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/will be permanently deleted/)).not.toBeInTheDocument();
    expect(deleteCalled).toBe(false);
    expect(screen.getByRole('heading', { name: 'A Manageable Article' })).toBeInTheDocument();
  });

  it('never shows Edit/Delete for a resource the viewer cannot manage', async () => {
    server.use(
      meHandler(MOCK_LECTURER_USER),
      http.get(`/api/v1/resources/${MANAGEABLE_RESOURCE.id}`, () =>
        HttpResponse.json({
          ...MANAGEABLE_RESOURCE,
          capabilities: { canEdit: false, canDelete: false },
        }),
      ),
    );
    renderAt(MANAGEABLE_RESOURCE.id);

    await screen.findByRole('heading', { name: 'A Manageable Article' });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
