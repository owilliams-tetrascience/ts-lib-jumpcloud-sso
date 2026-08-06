/**
 * Composes the single publishable package `@tetrascience-npm/jumpcloud-sso`
 * from the built output of the three buildable libraries:
 *
 *   packages/core/dist    -> packages/jumpcloud-sso/dist/core
 *   packages/next/dist    -> packages/jumpcloud-sso/dist/next
 *   packages/express/dist -> packages/jumpcloud-sso/dist/express
 *   packages/setup/dist   -> packages/jumpcloud-sso/dist/setup  (CLI bin)
 *
 * The composed layout matches the `exports` map in
 * packages/jumpcloud-sso/package.json (`./core`, `./next`, `./express`).
 * Cross-entry imports in the built JS use the package's own subpaths
 * (e.g. `@tetrascience-npm/jumpcloud-sso/core`), which Node resolves via
 * package self-reference at runtime — so the copied files work as-is.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageRoot = resolve(workspaceRoot, 'packages/jumpcloud-sso');
const outDir = resolve(packageRoot, 'dist');
const entries = ['core', 'next', 'express', 'setup'];

rmSync(outDir, { recursive: true, force: true });

for (const entry of entries) {
  const libDist = resolve(workspaceRoot, 'packages', entry, 'dist');
  const marker = resolve(libDist, 'index.js');
  const types = resolve(libDist, 'index.d.ts');
  if (!existsSync(marker) || !existsSync(types)) {
    console.error(
      `[compose-package] Missing built output for "${entry}" (expected ${marker} and ${types}). ` +
        `Run \`nx build ${entry}\` first — or let Nx handle it via \`nx build jumpcloud-sso\`.`,
    );
    process.exit(1);
  }
  cpSync(libDist, resolve(outDir, entry), { recursive: true });
  console.log(`[compose-package] dist/${entry} <- packages/${entry}/dist`);
}

console.log(`[compose-package] Composed package at ${packageRoot}`);
