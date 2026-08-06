/**
 * @tetrascience-npm/jumpcloud-sso — setup CLI internals.
 *
 * The user-facing entry point is the package bin (`bin.js`, from bin.ts):
 * `npx @tetrascience-npm/jumpcloud-sso setup`. This module exposes the pure
 * planning/template layer for tests and programmatic use.
 */
export { buildPlan, dependenciesFor, mergeEnvExample } from './lib/plan.js';
export type {
  PackageManager,
  PlannedFile,
  ProjectShape,
  ProjectType,
  SetupPlan,
} from './lib/plan.js';
export {
  expressEnvExample,
  expressSsoFile,
  nextAuthFile,
  nextEnvExample,
  nextMiddlewareFile,
  nextRouteHandlerFile,
  nextSessionFile,
} from './lib/templates.js';
