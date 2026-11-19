import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResourceCreateInput } from '@academy-library/contracts';
import { server } from '../../test/mswServer';
import { coursesHandler, groupsHandler, meHandler } from '../../test/mswHandlers';
import { MOCK_LECTURER_USER } from '../../test/authFixtures';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ResourceForm } from './ResourceForm';

const COURSES = [
  { id: 'course-algo', title: 'Algorithms & Data Structures' },
  { id: 'course-cs101', title: 'Introduction to Computer Science' },
];
const GROUPS = [{ id: 'group-honors', name: 'Honors Cohort' }];

function renderCreateForm(onSubmit = vi.fn<(input: ResourceCreateInput) => void>()) {
  server.use(meHandler(MOCK_LECTURER_USER), coursesHandler(COURSES), groupsHandler(GROUPS));
  renderWithProviders(<ResourceForm mode="create" onSubmit={onSubmit} isSubmitting={false} />);
  return onSubmit;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ResourceForm', () => {
  it('shows validation errors for required fields and does not call onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = renderCreateForm();

    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('Creator name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the duration field only for VIDEO/RECORDING, and requires it', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    expect(screen.queryByLabelText(/Duration \(minutes\)/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Resource type/), 'VIDEO');
    expect(await screen.findByLabelText(/Duration \(minutes\)/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Resource type/), 'ARTICLE');
    await waitFor(() => {
      expect(screen.queryByLabelText(/Duration \(minutes\)/)).not.toBeInTheDocument();
    });
  });

  it('shows the restricted-group picker only when visibility is RESTRICTED', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    expect(screen.queryByText('Restricted to')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Restricted — only specific groups'));
    expect(await screen.findByText('Restricted to')).toBeInTheDocument();
    expect(await screen.findByLabelText('Honors Cohort')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Public — visible to everyone'));
    await waitFor(() => {
      expect(screen.queryByText('Restricted to')).not.toBeInTheDocument();
    });
  });

  it('adds and removes tags via the tag input', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    const tagInput = screen.getByLabelText('Tags');
    await user.type(tagInput, 'machine-learning{enter}');
    expect(screen.getByText('machine-learning')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove tag machine-learning' }));
    expect(screen.queryByText('machine-learning')).not.toBeInTheDocument();
  });

  it('submits a complete, valid create payload', async () => {
    const user = userEvent.setup();
    const onSubmit = renderCreateForm();

    // `required` fields render a trailing, `aria-hidden` "*" marker
    // inside the <label> that's still part of its plain-text content —
    // an exact string match against just "Title" would miss it (see
    // docs/architecture/decisions.md, Task 05C.1's RTL query gotcha).
    await user.type(screen.getByLabelText(/^Title/), 'A New Article');
    await user.type(screen.getByLabelText(/^Description/), 'Describes something useful.');
    await user.type(screen.getByLabelText(/^Creator name/), 'Jane Doe');
    await user.click(await screen.findByLabelText('Algorithms & Data Structures'));

    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const call = onSubmit.mock.calls[0];
    if (!call) throw new Error('Expected onSubmit to have been called with a payload');
    const [submitted] = call;
    expect(submitted.title).toBe('A New Article');
    expect(submitted.courseIds).toEqual(['course-algo']);
    expect(submitted.visibility).toBe('PUBLIC');
  });

  it('disables the submit button in edit mode until a field actually changes', async () => {
    server.use(meHandler(MOCK_LECTURER_USER), coursesHandler(COURSES), groupsHandler(GROUPS));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ResourceForm
        mode="edit"
        onSubmit={onSubmit}
        isSubmitting={false}
        initialResource={{
          id: 'res-1',
          type: 'ARTICLE',
          title: 'Existing',
          description: 'Already here.',
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
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await user.type(screen.getByLabelText(/^Title/), '!');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
