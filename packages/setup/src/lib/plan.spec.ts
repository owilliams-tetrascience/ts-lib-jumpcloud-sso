import { describe, expect, it } from 'vitest';
import { buildPlan, dependenciesFor, mergeEnvExample } from './plan.js';

describe('buildPlan (next)', () => {
  const plan = buildPlan('next', { hasSrcDir: false, packageManager: 'npm' });

  it('plans the four wiring files at the project root', () => {
    expect(plan.files.map((f) => f.path)).toEqual([
      'auth.ts',
      'session.ts',
      'middleware.ts',
      'app/api/auth/[...nextauth]/route.ts',
    ]);
  });

  it('moves everything under src/ when the app does', () => {
    const srcPlan = buildPlan('next', {
      hasSrcDir: true,
      packageManager: 'npm',
    });
    expect(srcPlan.files.map((f) => f.path)).toEqual([
      'src/auth.ts',
      'src/session.ts',
      'src/middleware.ts',
      'src/app/api/auth/[...nextauth]/route.ts',
    ]);
  });

  it('generates files that import from the published package', () => {
    for (const file of plan.files) {
      expect(file.contents).toMatch(
        /@tetrascience-npm\/jumpcloud-sso\/(next|core)|\.\.\/auth|\.\/auth/,
      );
    }
  });

  it('includes AUTH_SECRET in the env block and the install step', () => {
    expect(plan.envExample).toContain('AUTH_SECRET=');
    expect(plan.envExample).toContain('JUMPCLOUD_CLIENT_ID=');
    expect(plan.nextSteps[0]).toBe(
      'Install the runtime dependencies: npm install @tetrascience-npm/jumpcloud-sso next-auth@beta',
    );
  });
});

describe('buildPlan (express)', () => {
  const plan = buildPlan('express', {
    hasSrcDir: false,
    packageManager: 'yarn',
  });

  it('plans src/sso.ts built on createSSORouter', () => {
    expect(plan.files.map((f) => f.path)).toEqual(['src/sso.ts']);
    expect(plan.files[0].contents).toContain('createSSORouter');
    expect(plan.files[0].contents).toContain(
      '@tetrascience-npm/jumpcloud-sso/express',
    );
  });

  it('uses the detected package manager in the install step', () => {
    expect(plan.nextSteps[0]).toBe(
      'Install the runtime dependencies: yarn add @tetrascience-npm/jumpcloud-sso express-openid-connect@^2',
    );
  });

  it('env block covers BASE_URL and SESSION_SECRET', () => {
    expect(plan.envExample).toContain('BASE_URL=');
    expect(plan.envExample).toContain('SESSION_SECRET=');
  });
});

describe('dependenciesFor', () => {
  it('pins the framework peer each integration needs', () => {
    expect(dependenciesFor('next')).toContain('next-auth@beta');
    expect(dependenciesFor('express')).toContain('express-openid-connect@^2');
  });
});

describe('mergeEnvExample', () => {
  const block = 'JUMPCLOUD_CLIENT_ID=\nJUMPCLOUD_CLIENT_SECRET=\n';

  it('returns the block as-is for a missing or empty file', () => {
    expect(mergeEnvExample(null, block)).toBe(block);
    expect(mergeEnvExample('  \n', block)).toBe(block);
  });

  it('appends to existing content with a blank-line separator', () => {
    expect(mergeEnvExample('PORT=3000\n', block)).toBe(`PORT=3000\n\n${block}`);
  });

  it('never duplicates an existing JumpCloud block', () => {
    expect(mergeEnvExample(`# mine\n${block}`, block)).toBeNull();
  });
});
