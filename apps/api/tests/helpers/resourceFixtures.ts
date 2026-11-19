import type { Role } from '@prisma/client';
import type {
  ResourceDifficulty,
  ResourceType,
  ResourceVisibility,
} from '@academy-library/contracts';
import { hashPassword } from '../../src/lib/password.js';
import { prisma } from '../../src/lib/prisma.js';
import {
  createResource,
  upsertTagsByNames,
} from '../../src/modules/resources/resource.repository.js';
import type { ResourceWithRelations } from '../../src/modules/resources/resource.types.js';

/** Every test user shares this password — never read by anything but
 * `loginAs` below, and only ever written to a dedicated test database
 * (see vitest.config.ts). */
export const TEST_USER_PASSWORD = 'Password123!';

let testUserCounter = 0;

export async function createTestUser(role: Role, displayName = `${role} Test`) {
  testUserCounter += 1;
  const passwordHash = await hashPassword(TEST_USER_PASSWORD);
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${testUserCounter}@example.com`,
      passwordHash,
      displayName,
      role,
      status: 'ACTIVE',
    },
  });
}

export function createGroup(name: string) {
  return prisma.group.create({ data: { name } });
}

export function addUserToGroup(userId: string, groupId: string) {
  return prisma.groupMembership.create({ data: { userId, groupId } });
}

export function createCourse(title: string) {
  return prisma.course.create({ data: { title } });
}

export interface TestResourceInput {
  title: string;
  description?: string;
  type?: ResourceType;
  difficulty?: ResourceDifficulty;
  creatorName?: string;
  ownerId: string;
  visibility?: ResourceVisibility;
  durationSeconds?: number | null;
  tags?: string[];
  courseIds?: string[];
  groupIds?: string[];
}

/** Builds fixtures through the real repository (`createResource`,
 * `upsertTagsByNames`) rather than raw `prisma.resource.create` calls —
 * the same code path a real `POST /resources` request exercises, so a
 * fixture can never drift from what the application actually writes. */
export async function createTestResource(input: TestResourceInput): Promise<ResourceWithRelations> {
  const tagRows = await upsertTagsByNames((input.tags ?? []).map((tag) => tag.toLowerCase()));
  return createResource({
    title: input.title,
    description: input.description ?? 'A test resource used only by this test file.',
    type: input.type ?? 'ARTICLE',
    difficulty: input.difficulty ?? 'BEGINNER',
    creatorName: input.creatorName ?? 'Test Creator',
    visibility: input.visibility ?? 'PUBLIC',
    ownerId: input.ownerId,
    durationSeconds: input.durationSeconds ?? null,
    tagIds: tagRows.map((tag) => tag.id),
    courseIds: input.courseIds ?? [],
    groupIds: input.groupIds ?? [],
  });
}
