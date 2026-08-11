import {
  DEFAULT_GROUPS_CLAIM,
  DEFAULT_ISSUER,
  type JumpCloudCommon,
} from './config.js';

/**
 * The value `next build` sets in `NEXT_PHASE`.
 * @see next/dist/build/index.js, which assigns `PHASE_PRODUCTION_BUILD`
 */
const NEXT_BUILD_PHASE = 'phase-production-build';

/**
 * Stand-in credentials used only when `next build` runs without secrets.
 *
 * Deliberately self-describing: if one of these ever reaches a token request,
 * JumpCloud's error names the actual problem instead of "invalid client".
 */
const BUILD_PHASE_PLACEHOLDER = 'jumpcloud-sso-unset-at-build-time';

/**
 * The TetraScience environment variable convention for JumpCloud SSO.
 * Every app using this package reads the same variable names.
 */
export const JUMPCLOUD_ENV_VARS = {
  clientId: 'JUMPCLOUD_CLIENT_ID',
  clientSecret: 'JUMPCLOUD_CLIENT_SECRET',
  issuer: 'JUMPCLOUD_ISSUER',
  groupsClaim: 'JUMPCLOUD_GROUPS_CLAIM',
} as const;

/**
 * Reads JumpCloud SSO configuration from environment variables, following the
 * TetraScience convention:
 *
 * | Variable                  | Required | Default                            |
 * | ------------------------- | -------- | ---------------------------------- |
 * | `JUMPCLOUD_CLIENT_ID`     | yes      | —                                  |
 * | `JUMPCLOUD_CLIENT_SECRET` | yes      | —                                  |
 * | `JUMPCLOUD_ISSUER`        | no       | `https://oauth.id.jumpcloud.com/`  |
 * | `JUMPCLOUD_GROUPS_CLAIM`  | no       | `memberOf`                         |
 *
 * Fails fast: throws a single error listing every missing required variable,
 * so a misconfigured deployment dies at boot with an actionable message
 * instead of failing at first login.
 *
 * @param env - The variable source, defaulting to `process.env`. Injectable
 * for tests.
 * @returns A {@link JumpCloudCommon} with `issuer` and `groupsClaim` filled in.
 * @throws Error when `JUMPCLOUD_CLIENT_ID` or `JUMPCLOUD_CLIENT_SECRET` is
 * missing or empty.
 */
export function resolveEnv(
  env: Record<string, string | undefined> = process.env,
): JumpCloudCommon & { issuer: string; groupsClaim: string } {
  const clientId = env[JUMPCLOUD_ENV_VARS.clientId];
  const clientSecret = env[JUMPCLOUD_ENV_VARS.clientSecret];

  if (!clientId || !clientSecret) {
    const missing: string[] = [];
    if (!clientId) {
      missing.push(JUMPCLOUD_ENV_VARS.clientId);
    }
    if (!clientSecret) {
      missing.push(JUMPCLOUD_ENV_VARS.clientSecret);
    }

    // `next build` legitimately runs without runtime secrets — CI builds the
    // app long before it has credentials. Warning instead of throwing here is
    // what lets an app call `resolveEnv()` directly in `auth.ts` rather than
    // writing `?? 'placeholder-client-id'` fallbacks, which is the pattern
    // this exception exists to make unnecessary: a fallback survives into
    // production and defers the failure to the first user's sign-in, whereas
    // these values only ever reach a build that signs nobody in.
    //
    // Mirrors the AUTH_SECRET handling in `createJumpCloudAuth`.
    if (env['NEXT_PHASE'] === NEXT_BUILD_PHASE) {
      console.warn(
        `[jumpcloud-sso] ${missing.join(' and ')} not set during \`next build\`. ` +
          'The build will succeed, but sign-in will fail at runtime unless ' +
          'these are set in the deployment environment.',
      );
      return {
        clientId: clientId || BUILD_PHASE_PLACEHOLDER,
        clientSecret: clientSecret || BUILD_PHASE_PLACEHOLDER,
        issuer: env[JUMPCLOUD_ENV_VARS.issuer] || DEFAULT_ISSUER,
        groupsClaim:
          env[JUMPCLOUD_ENV_VARS.groupsClaim] || DEFAULT_GROUPS_CLAIM,
      };
    }

    throw new Error(
      `[jumpcloud-sso] Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to your environment and fill in the values from ' +
        'your JumpCloud OIDC application.',
    );
  }

  return {
    clientId,
    clientSecret,
    issuer: env[JUMPCLOUD_ENV_VARS.issuer] || DEFAULT_ISSUER,
    groupsClaim: env[JUMPCLOUD_ENV_VARS.groupsClaim] || DEFAULT_GROUPS_CLAIM,
  };
}
