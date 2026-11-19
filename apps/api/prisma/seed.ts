/**
 * Deterministic, idempotent development seed — creates one account per
 * role, a small group/membership/course/tag foundation, and a varied set
 * of resources exercising every resource type, both visibilities, and
 * both owning roles, so local development and manual testing never
 * start from an empty database. Safe to run repeatedly: every entity is
 * looked up by its natural key first and updated in place rather than
 * duplicated — see each `seed*` function below for its specific lookup
 * key, since not everything has (or should have) a DB-level unique
 * constraint to upsert against.
 *
 * Deliberately NOT reachable from any API endpoint — this is the only
 * place in the codebase that creates a `LECTURER`/`ADMIN` account or a
 * `Group`/`GroupMembership` row (there is no Group CRUD API in this
 * task), which is exactly the point: non-student accounts and group
 * membership only come from this script or direct database
 * administration, never from an HTTP request.
 *
 * See docs/architecture/authentication.md ("Development accounts") for
 * account password overrides and docs/domain/resources.md ("Development
 * seed") for the resource/group fixtures below.
 */
import { PrismaClient } from '@prisma/client';
import type {
  Course,
  Group,
  ResourceDifficulty,
  ResourceType,
  ResourceVisibility,
  Role,
  User,
} from '@prisma/client';
import { logger } from '../src/lib/logger.js';
import { hashPassword } from '../src/lib/password.js';
import { normalizeEmail } from '../src/modules/auth/user.repository.js';
import {
  createResource,
  updateResource,
  upsertTagsByNames,
  type CreateResourceData,
} from '../src/modules/resources/resource.repository.js';

const prisma = new PrismaClient();

const DEFAULT_DEV_PASSWORD = 'DevPassword123!';

interface SeedAccount {
  email: string;
  displayName: string;
  role: Role;
  /** Env var a developer can set to override `DEFAULT_DEV_PASSWORD` for
   * this one account — never a real secret, just a way to avoid every
   * local checkout sharing the literal same password byte-for-byte. */
  passwordEnvVar: string;
}

const SEED_ACCOUNTS: readonly SeedAccount[] = [
  {
    email: 'student@academy.test',
    displayName: 'Sam Student',
    role: 'STUDENT',
    passwordEnvVar: 'SEED_STUDENT_PASSWORD',
  },
  {
    email: 'lecturer@academy.test',
    displayName: 'Lee Lecturer',
    role: 'LECTURER',
    passwordEnvVar: 'SEED_LECTURER_PASSWORD',
  },
  {
    email: 'admin@academy.test',
    displayName: 'Alex Admin',
    role: 'ADMIN',
    passwordEnvVar: 'SEED_ADMIN_PASSWORD',
  },
];

async function seedAccount(account: SeedAccount): Promise<User> {
  const email = normalizeEmail(account.email);
  const password = process.env[account.passwordEnvVar] ?? DEFAULT_DEV_PASSWORD;
  const passwordHash = await hashPassword(password);

  // Not `prisma.user.upsert` — `email` isn't a Prisma-declared unique
  // field (see the case-insensitive-uniqueness note in schema.prisma),
  // so Prisma Client has no `where: { email }` to upsert against. A
  // plain find-then-write is fine here; a seed script has no concurrent
  // writers to race against.
  const existing = await prisma.user.findFirst({ where: { email } });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          displayName: account.displayName,
          role: account.role,
          status: 'ACTIVE',
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: account.displayName,
          role: account.role,
          status: 'ACTIVE',
        },
      });

  logger.info(`Seeded ${account.role} account: ${email}`);
  return user;
}

// ---------------------------------------------------------------------
// Groups and memberships
// ---------------------------------------------------------------------

/** `Group.name` is a real, Prisma-declared unique field (unlike
 * `User.email`), so this can be a genuine `upsert`. */
async function seedGroup(name: string): Promise<Group> {
  const group = await prisma.group.upsert({ where: { name }, create: { name }, update: {} });
  logger.info(`Seeded group: ${name}`);
  return group;
}

const GROUP_MEMBERSHIPS: readonly { email: string; groupName: string }[] = [
  { email: 'lecturer@academy.test', groupName: 'CS Department Staff' },
  { email: 'admin@academy.test', groupName: 'CS Department Staff' },
  { email: 'admin@academy.test', groupName: 'Honors Cohort' },
  { email: 'student@academy.test', groupName: 'Honors Cohort' },
];

async function seedMembership(userId: string, groupId: string): Promise<void> {
  await prisma.groupMembership.upsert({
    where: { userId_groupId: { userId, groupId } },
    create: { userId, groupId },
    update: {},
  });
}

// ---------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------

const COURSE_TITLES: readonly string[] = [
  'Introduction to Computer Science',
  'Algorithms & Data Structures',
  'Databases at Scale',
  'Machine Learning Foundations',
  'Software Architecture',
];

/** `Course.title` is also a real unique field — same reasoning as
 * `seedGroup`. */
async function seedCourse(title: string): Promise<Course> {
  const course = await prisma.course.upsert({ where: { title }, create: { title }, update: {} });
  logger.info(`Seeded course: ${title}`);
  return course;
}

// ---------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------

interface ResourceSeed {
  title: string;
  description: string;
  type: ResourceType;
  difficulty: ResourceDifficulty;
  creatorName: string;
  creatorAffiliation?: string;
  sourceUrl?: string;
  publisher?: string;
  /** ISO date string — kept as a plain string here and parsed to `Date`
   * at the call site, same as every other date-ish seed fixture. */
  publishedAt?: string;
  durationSeconds?: number;
  visibility: ResourceVisibility;
  restrictedToGroupNames?: string[];
  courseTitles: string[];
  tags: string[];
  ownerEmail: string;
}

/**
 * Covers all six resource types, all three difficulties, both
 * visibilities (including one resource restricted to two groups at
 * once), and both roles that can own a resource — enough variety for
 * manual testing and for the integration tests to have real fixtures to
 * assert against (see tests/resources.routes.test.ts).
 */
const RESOURCE_SEEDS: readonly ResourceSeed[] = [
  {
    title: 'Introduction to Algorithms',
    description:
      'The standard reference on algorithms and data structures, covering sorting, graph algorithms, and algorithmic analysis from first principles.',
    type: 'BOOK',
    difficulty: 'BEGINNER',
    creatorName: 'R. Kesari',
    publisher: 'MIT Press',
    publishedAt: '2009-07-31T00:00:00.000Z',
    visibility: 'PUBLIC',
    courseTitles: ['Algorithms & Data Structures', 'Introduction to Computer Science'],
    tags: ['algorithms', 'data-structures'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Designing Data-Intensive Applications',
    description:
      'A deep look at the principles behind reliable, scalable data systems — replication, partitioning, transactions, and consistency.',
    type: 'BOOK',
    difficulty: 'ADVANCED',
    creatorName: 'M. Kleppmann',
    publisher: "O'Reilly Media",
    publishedAt: '2017-03-16T00:00:00.000Z',
    visibility: 'PUBLIC',
    courseTitles: ['Databases at Scale', 'Software Architecture'],
    tags: ['databases', 'systems-design'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'A Gentle Introduction to Gradient Descent',
    description:
      'Builds up gradient descent from a single-variable cost function to the multivariate case used to train real models.',
    type: 'ARTICLE',
    difficulty: 'INTERMEDIATE',
    creatorName: 'J. Alammar',
    sourceUrl: 'https://example.edu/articles/gradient-descent',
    visibility: 'PUBLIC',
    courseTitles: ['Machine Learning Foundations'],
    tags: ['machine-learning', 'statistics'],
    ownerEmail: 'admin@academy.test',
  },
  {
    title: 'Big-O Notation Explained',
    description:
      'A visual, example-driven walkthrough of algorithmic complexity and why it matters before you write a line of code.',
    type: 'VIDEO',
    difficulty: 'BEGINNER',
    creatorName: 'Lee Lecturer',
    durationSeconds: 720,
    visibility: 'PUBLIC',
    courseTitles: ['Algorithms & Data Structures'],
    tags: ['algorithms'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Binary Search Practice Set',
    description:
      'Ten hand-picked binary search variants, from the textbook case to off-by-one traps on rotated and duplicate-heavy arrays.',
    type: 'EXERCISE',
    difficulty: 'BEGINNER',
    creatorName: 'Lee Lecturer',
    visibility: 'PUBLIC',
    courseTitles: ['Algorithms & Data Structures'],
    tags: ['algorithms', 'data-structures'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Guest Lecture: Scaling Postgres at 10M QPS',
    description:
      'A recorded guest lecture on connection pooling, read replicas, and partitioning strategies at real production scale.',
    type: 'RECORDING',
    difficulty: 'ADVANCED',
    creatorName: 'Alex Admin',
    durationSeconds: 2700,
    publishedAt: '2024-11-02T00:00:00.000Z',
    visibility: 'PUBLIC',
    courseTitles: ['Databases at Scale'],
    tags: ['databases', 'systems-design'],
    ownerEmail: 'admin@academy.test',
  },
  {
    title: 'Dataset: Housing Prices (Cleaned)',
    description:
      'A cleaned, de-duplicated housing-price dataset prepared for regression exercises — no missing values, consistent units.',
    type: 'OTHER',
    difficulty: 'INTERMEDIATE',
    creatorName: 'Alex Admin',
    visibility: 'PUBLIC',
    courseTitles: ['Machine Learning Foundations'],
    tags: ['machine-learning'],
    ownerEmail: 'admin@academy.test',
  },
  {
    title: 'Advanced Systems Design Reading List',
    description:
      'A curated reading order through distributed systems classics, meant to follow Databases at Scale, not replace it.',
    type: 'BOOK',
    difficulty: 'ADVANCED',
    creatorName: 'Lee Lecturer',
    visibility: 'PUBLIC',
    courseTitles: ['Software Architecture', 'Databases at Scale'],
    tags: ['systems-design'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Career Conversations: From Bootcamp to Backend',
    description:
      'A relaxed, recorded panel conversation with three former students now working as backend engineers.',
    type: 'RECORDING',
    difficulty: 'BEGINNER',
    creatorName: 'Lee Lecturer',
    durationSeconds: 1800,
    visibility: 'PUBLIC',
    courseTitles: [],
    tags: ['career'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Faculty Hiring Committee Notes',
    description:
      'Internal notes from the department hiring committee — not for general circulation.',
    type: 'OTHER',
    difficulty: 'ADVANCED',
    creatorName: 'Lee Lecturer',
    visibility: 'RESTRICTED',
    restrictedToGroupNames: ['CS Department Staff'],
    courseTitles: [],
    tags: ['career'],
    ownerEmail: 'lecturer@academy.test',
  },
  {
    title: 'Honors Thesis Proposal Template',
    description:
      'The required proposal template and rubric for students in the honors thesis track.',
    type: 'ARTICLE',
    difficulty: 'INTERMEDIATE',
    creatorName: 'Alex Admin',
    visibility: 'RESTRICTED',
    restrictedToGroupNames: ['Honors Cohort'],
    courseTitles: [],
    tags: ['career'],
    ownerEmail: 'admin@academy.test',
  },
  {
    title: 'Weekly Algorithms Study Group (Restricted)',
    description:
      'Problem sets for the joint honors/staff weekly study group — restricted to its two participant groups.',
    type: 'EXERCISE',
    difficulty: 'INTERMEDIATE',
    creatorName: 'Lee Lecturer',
    visibility: 'RESTRICTED',
    restrictedToGroupNames: ['Honors Cohort', 'CS Department Staff'],
    courseTitles: ['Algorithms & Data Structures'],
    tags: ['algorithms'],
    ownerEmail: 'lecturer@academy.test',
  },
];

async function seedResource(
  seed: ResourceSeed,
  usersByEmail: ReadonlyMap<string, User>,
  groupsByName: ReadonlyMap<string, Group>,
  coursesByTitle: ReadonlyMap<string, Course>,
): Promise<void> {
  const owner = usersByEmail.get(normalizeEmail(seed.ownerEmail));
  if (!owner)
    throw new Error(`Seed resource "${seed.title}" references unknown owner ${seed.ownerEmail}`);

  const courseIds = seed.courseTitles.map((title) => {
    const course = coursesByTitle.get(title);
    if (!course)
      throw new Error(`Seed resource "${seed.title}" references unknown course ${title}`);
    return course.id;
  });
  const groupIds = (seed.restrictedToGroupNames ?? []).map((name) => {
    const group = groupsByName.get(name);
    if (!group) throw new Error(`Seed resource "${seed.title}" references unknown group ${name}`);
    return group.id;
  });
  const tagRows = await upsertTagsByNames(seed.tags.map((tag) => tag.trim().toLowerCase()));
  const tagIds = tagRows.map((tag) => tag.id);

  const sharedFields = {
    title: seed.title,
    description: seed.description,
    type: seed.type,
    difficulty: seed.difficulty,
    creatorName: seed.creatorName,
    creatorAffiliation: seed.creatorAffiliation ?? null,
    coverImageUrl: null,
    sourceUrl: seed.sourceUrl ?? null,
    publishedAt: seed.publishedAt ? new Date(seed.publishedAt) : null,
    publisher: seed.publisher ?? null,
    durationSeconds: seed.durationSeconds ?? null,
    visibility: seed.visibility,
    tagIds,
    courseIds,
    groupIds,
  };

  // Resources have no natural unique key to `upsert` against (titles are
  // not DB-unique, deliberately — see the `Resource` model's doc comment
  // in schema.prisma) — a plain find-by-title-then-write is fine here,
  // same reasoning as `seedAccount`'s email lookup. `updateResource`
  // never takes an `ownerId` (see resource.repository.ts — there is no
  // ownership-change path at all, by design), so re-seeding an existing
  // resource cannot change who owns it; the fixtures above are written
  // to keep each title's owner stable across edits for exactly that
  // reason.
  const existing = await prisma.resource.findFirst({ where: { title: seed.title } });
  if (existing) {
    await updateResource(existing.id, sharedFields);
  } else {
    const createData: CreateResourceData = { ...sharedFields, ownerId: owner.id };
    await createResource(createData);
  }
  logger.info(`Seeded resource: ${seed.title}`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    logger.error(
      'Refusing to run the development seed with NODE_ENV=production. ' +
        'This creates accounts with known, documented passwords — never acceptable outside development/test.',
    );
    process.exitCode = 1;
    return;
  }

  const usersByEmail = new Map<string, User>();
  for (const account of SEED_ACCOUNTS) {
    usersByEmail.set(normalizeEmail(account.email), await seedAccount(account));
  }

  const groupNames = [...new Set(GROUP_MEMBERSHIPS.map((membership) => membership.groupName))];
  const groupsByName = new Map<string, Group>();
  for (const name of groupNames) {
    groupsByName.set(name, await seedGroup(name));
  }
  for (const membership of GROUP_MEMBERSHIPS) {
    const user = usersByEmail.get(normalizeEmail(membership.email));
    const group = groupsByName.get(membership.groupName);
    if (!user || !group) continue;
    await seedMembership(user.id, group.id);
  }
  logger.info(`Seeded ${GROUP_MEMBERSHIPS.length} group memberships`);

  const coursesByTitle = new Map<string, Course>();
  for (const title of COURSE_TITLES) {
    coursesByTitle.set(title, await seedCourse(title));
  }

  for (const seed of RESOURCE_SEEDS) {
    await seedResource(seed, usersByEmail, groupsByName, coursesByTitle);
  }
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
