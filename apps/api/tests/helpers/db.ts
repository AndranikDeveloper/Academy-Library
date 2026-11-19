import { prisma } from '../../src/lib/prisma.js';

/** Wipes every row this test suite could have written. Deletes sessions
 * before users (the FK is `onDelete: Cascade`, so order doesn't matter
 * for correctness, but this avoids relying on that for clarity). Run
 * before each test, not just the whole suite, so tests never depend on
 * execution order or leak state into one another. */
export async function resetAuthTables(): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

/** Resources must be wiped before users: `Resource.ownerId` is an
 * `onDelete: Restrict` foreign key (see schema.prisma — deliberately not
 * cascading, since a resource should never silently disappear just
 * because its owner's account does), so a user row cannot be deleted
 * while any resource still references it. Deleting a resource itself
 * cascades its `resource_tags`/`resource_courses`/`resource_groups`
 * rows automatically. */
export async function resetResourceTables(): Promise<void> {
  await prisma.resource.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.course.deleteMany();
  await prisma.tag.deleteMany();
}

export async function resetAllTables(): Promise<void> {
  await resetResourceTables();
  await resetAuthTables();
}
