import { http, HttpResponse } from 'msw';
import { ZodError } from 'zod';
import type {
  ApiErrorResponse,
  AuthResponse,
  CourseRef,
  GroupRef,
  PublicUser,
} from '@academy-library/contracts';
import {
  ResourceCreateInputSchema,
  ResourceListQuerySchema,
  ResourceUpdateInputSchema,
} from '@academy-library/contracts';
import { MOCK_STUDENT_USER } from './authFixtures';
import { isApiError } from '../shared/api/ApiError';
import { mockResourceRepository } from '../shared/data/resources';

const API_BASE_URL = '/api/v1';

export const MOCK_CSRF_TOKEN = 'test-csrf-token';

export function apiError(
  status: number,
  body: ApiErrorResponse,
): ReturnType<typeof HttpResponse.json> {
  return HttpResponse.json(body, { status });
}

export function authResponse(user: PublicUser): AuthResponse {
  return { user };
}

/**
 * The CSRF-token handler every test needs — `httpClient.ts` fetches it
 * ahead of every non-GET request, regardless of which auth flow a given
 * test is exercising.
 */
export const csrfTokenHandler = http.get(`${API_BASE_URL}/auth/csrf-token`, () =>
  HttpResponse.json({ csrfToken: MOCK_CSRF_TOKEN }),
);

export function loginHandler(user: PublicUser = MOCK_STUDENT_USER) {
  return http.post(`${API_BASE_URL}/auth/login`, () => HttpResponse.json(authResponse(user)));
}

export const invalidLoginHandler = http.post(`${API_BASE_URL}/auth/login`, () =>
  apiError(401, { error: { message: 'Invalid email or password', code: 'UNAUTHORIZED' } }),
);

export function registerHandler(user: PublicUser = MOCK_STUDENT_USER) {
  return http.post(`${API_BASE_URL}/auth/register`, () =>
    HttpResponse.json(authResponse(user), { status: 201 }),
  );
}

export const duplicateEmailHandler = http.post(`${API_BASE_URL}/auth/register`, () =>
  apiError(409, {
    error: { message: 'An account with this email already exists', code: 'CONFLICT' },
  }),
);

export const logoutHandler = http.post(
  `${API_BASE_URL}/auth/logout`,
  () => new HttpResponse(null, { status: 204 }),
);

export function meHandler(user: PublicUser | null = MOCK_STUDENT_USER) {
  return http.get(`${API_BASE_URL}/auth/me`, () =>
    user
      ? HttpResponse.json(authResponse(user))
      : apiError(401, { error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }),
  );
}

export const invalidCsrfHandler = http.post(`${API_BASE_URL}/auth/login`, () =>
  apiError(403, {
    error: { message: 'Invalid or missing CSRF token', code: 'INVALID_CSRF_TOKEN' },
  }),
);

/** The common "anonymous visitor, happy path available" baseline most
 * tests start from, then override individual handlers with `server.use`
 * for the specific scenario under test. */
export const defaultAuthHandlers = [
  csrfTokenHandler,
  meHandler(null),
  loginHandler(),
  registerHandler(),
  logoutHandler,
];

/** Builds the real `GET /resources` querystring back into a
 * `ResourceListQuery` the same way the real backend route does (notably
 * splitting the comma-joined `tags` param into an array before it
 * reaches the shared schema, which expects `tags` as `string[]` already
 * — see `apps/api/src/routes/resources.routes.ts`). */
function parseResourceListQuery(url: URL) {
  const params = url.searchParams;
  const raw: Record<string, unknown> = {};
  for (const key of [
    'search',
    'type',
    'difficulty',
    'courseId',
    'visibility',
    'sort',
    'page',
    'pageSize',
  ]) {
    const value = params.get(key);
    if (value !== null) raw[key] = value;
  }
  const tags = params.get('tags');
  if (tags !== null) raw.tags = tags.split(',').filter(Boolean);
  return ResourceListQuerySchema.parse(raw);
}

/**
 * Network-level stand-ins for the real `GET /resources`/`GET
 * /resources/:id` endpoints, backed by `mockResourceRepository` — this
 * is exactly the "isolated tests" use case `mockResourceRepository` is
 * still kept around for (see `shared/data/resources/index.ts`): the
 * same fixture data and filter/sort/pagination behavior the frontend
 * code used to get directly now arrives the same way production data
 * does, over MSW-intercepted HTTP, so these tests exercise the real
 * `HttpResourceRepository` wiring rather than bypassing it.
 */
export const resourceListHandler = http.get('/api/v1/resources', async ({ request }) => {
  const query = parseResourceListQuery(new URL(request.url));
  const result = await mockResourceRepository.list(query);
  return HttpResponse.json(result);
});

export const resourceDetailHandler = http.get('/api/v1/resources/:id', async ({ params }) => {
  const detail = await mockResourceRepository.getById(params.id as string);
  if (!detail) {
    return apiError(404, { error: { message: 'Resource not found', code: 'NOT_FOUND' } });
  }
  return HttpResponse.json(detail);
});

/** Converts a thrown `ZodError` (the real backend's own errorHandler.ts
 * does the identical translation for a raw schema-parse failure) or
 * `ApiError` (this mock's own `notFoundError`) into the same envelope
 * shape every mutation handler below needs, so a test exercising a
 * validation or not-found failure sees the real response shape. */
function toErrorResponse(error: unknown): ReturnType<typeof HttpResponse.json> {
  if (error instanceof ZodError) {
    return apiError(400, {
      error: {
        message: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        details: error.flatten(),
      },
    });
  }
  if (isApiError(error)) {
    return apiError(error.status, {
      error: { message: error.message, code: error.code, details: error.details },
    });
  }
  throw error;
}

export const resourceCreateHandler = http.post('/api/v1/resources', async ({ request }) => {
  try {
    // Validated against the real request-shape schema first — same as
    // the real backend's route handler — rather than trusting whatever
    // JSON a test sends: a deliberately malformed body (missing title,
    // etc.) needs to produce the same `VALIDATION_ERROR` 400 a real
    // backend would, not whatever `mockResourceRepository.create` would
    // do with an unvalidated object.
    const body = ResourceCreateInputSchema.parse(await request.json());
    const created = await mockResourceRepository.create(body);
    return HttpResponse.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
});

export const resourceUpdateHandler = http.patch(
  '/api/v1/resources/:id',
  async ({ request, params }) => {
    try {
      const body = ResourceUpdateInputSchema.parse(await request.json());
      const updated = await mockResourceRepository.update(params.id as string, body);
      return HttpResponse.json(updated);
    } catch (error) {
      return toErrorResponse(error);
    }
  },
);

export const resourceDeleteHandler = http.delete('/api/v1/resources/:id', async ({ params }) => {
  try {
    await mockResourceRepository.delete(params.id as string);
    return new HttpResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
});

const MOCK_GROUPS: GroupRef[] = [
  { id: 'group-cs-staff', name: 'CS Department Staff' },
  { id: 'group-honors', name: 'Honors Cohort' },
];

export function coursesHandler(courses: CourseRef[]) {
  return http.get('/api/v1/courses', () => HttpResponse.json(courses));
}

export function groupsHandler(groups: GroupRef[] = MOCK_GROUPS) {
  return http.get('/api/v1/groups', () => HttpResponse.json(groups));
}

/** The full set of resource-mutation handlers a create/edit/delete test
 * typically needs together — `server.use(...defaultResourceWriteHandlers, meHandler(user))`. */
export const defaultResourceWriteHandlers = [
  resourceCreateHandler,
  resourceUpdateHandler,
  resourceDeleteHandler,
  coursesHandler([
    { id: 'course-algo', title: 'Algorithms & Data Structures' },
    { id: 'course-cs101', title: 'Introduction to Computer Science' },
  ]),
  groupsHandler(),
];
