import {
  DEFAULT_GROUPS_CLAIM,
  DEFAULT_ISSUER,
  type JumpCloudCommon,
} from './config.js';

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
