/**
 * Pure planning logic for `jumpcloud-sso setup`: given what kind of project
 * we're scaffolding into and its shape, decide which files to write and what
 * the user must do afterwards. No filesystem access — bin.ts observes the
 * project and applies the plan.
 */
import {
  expressEnvExample,
  expressSsoFile,
  nextAuthFile,
  nextEnvExample,
  nextMiddlewareFile,
  nextRouteHandlerFile,
  nextSessionFile,
} from './templates.js';

/** Which framework integration to scaffold. */
export type ProjectType = 'next' | 'express';

/** Package managers we emit install commands for. */
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/** What the CLI observed about the target project. */
export interface ProjectShape {
  /** Next.js: whether the app lives under `src/` (`src/app` exists). */
  hasSrcDir: boolean;
  packageManager: PackageManager;
}

/** One file the setup will create (paths relative to the project root). */
export interface PlannedFile {
  path: string;
  contents: string;
}

/** The full plan: files, env block, and post-scaffold instructions. */
export interface SetupPlan {
  type: ProjectType;
  files: PlannedFile[];
  /** Block merged into `.env.example` (created if absent). */
  envExample: string;
  /** Human next-steps printed after scaffolding. */
  nextSteps: string[];
}

const INSTALL: Record<PackageManager, string> = {
  npm: 'npm install',
  yarn: 'yarn add',
  pnpm: 'pnpm add',
};

/** Peer packages each integration needs at runtime. */
export function dependenciesFor(type: ProjectType): string[] {
  return type === 'next'
    ? ['@tetrascience-npm/jumpcloud-sso', 'next-auth@beta']
    : ['@tetrascience-npm/jumpcloud-sso', 'express-openid-connect@^2'];
}

/** Builds the complete scaffolding plan. Pure — safe to unit test. */
export function buildPlan(type: ProjectType, shape: ProjectShape): SetupPlan {
  const install = `${INSTALL[shape.packageManager]} ${dependenciesFor(type).join(' ')}`;

  if (type === 'next') {
    // With a `src` directory, ALL of these live under src/ (Next.js reads
    // middleware.ts from src/ too, and the route handler's relative import
    // of ../../../../auth still resolves to src/auth.ts).
    const base = shape.hasSrcDir ? 'src/' : '';
    return {
      type,
      files: [
        { path: `${base}auth.ts`, contents: nextAuthFile() },
        { path: `${base}session.ts`, contents: nextSessionFile() },
        { path: `${base}middleware.ts`, contents: nextMiddlewareFile() },
        {
          path: `${base}app/api/auth/[...nextauth]/route.ts`,
          contents: nextRouteHandlerFile(),
        },
      ],
      envExample: nextEnvExample(),
      nextSteps: [
        `Install the runtime dependencies: ${install}`,
        'Generate an Auth.js secret: npx auth secret (fills AUTH_SECRET in .env.local)',
        'Copy the JUMPCLOUD_* values from your JumpCloud OIDC application into .env.local (see .env.example)',
        'Register the redirect URI on the JumpCloud OIDC application: <your-app-url>/api/auth/callback/jumpcloud',
        "Protect pages with requireSession() from ./session, and gate paths by group via routeGroups in auth.ts (e.g. '/admin': ['app-admins'])",
      ],
    };
  }

  return {
    type,
    files: [{ path: 'src/sso.ts', contents: expressSsoFile() }],
    envExample: expressEnvExample(),
    nextSteps: [
      `Install the runtime dependencies: ${install}`,
      'Generate a session secret: openssl rand -hex 32 (fills SESSION_SECRET in your env)',
      'Copy the JUMPCLOUD_* values from your JumpCloud OIDC application into your env (see .env.example)',
      'Register the redirect URI on the JumpCloud OIDC application: ${BASE_URL}/callback',
      "Mount it in your server: import { sso } from './sso'; app.use(sso.router); then guard routes with sso.requireAuth or sso.requireGroup(['group-name'])",
    ],
  };
}

/**
 * Merges the setup's env block into an existing `.env.example`. Returns the
 * new file contents, or `null` when the file already mentions
 * JUMPCLOUD_CLIENT_ID (assume a previous run — never duplicate).
 */
export function mergeEnvExample(
  existing: string | null,
  block: string,
): string | null {
  if (existing === null || existing.trim() === '') {
    return block;
  }
  if (existing.includes('JUMPCLOUD_CLIENT_ID')) {
    return null;
  }
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${block}`;
}
