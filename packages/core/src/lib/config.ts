/**
 * The default JumpCloud OIDC issuer.
 *
 * The trailing slash is load-bearing: OIDC discovery resolves
 * `.well-known/openid-configuration` against this URL, and JumpCloud's
 * discovery document declares its issuer as `https://oauth.id.jumpcloud.com/`
 * (with the slash). Removing it makes issuer validation — and therefore the
 * whole login flow — fail.
 */
export const DEFAULT_ISSUER = 'https://oauth.id.jumpcloud.com/';

/**
 * The default name of the ID-token claim that carries JumpCloud group names.
 * JumpCloud calls this the "group attribute" when you configure the OIDC app;
 * TetraScience's convention is `groups`.
 */
export const DEFAULT_GROUPS_CLAIM = 'groups';

/**
 * The default OAuth scopes requested during login. `openid` is mandatory for
 * OIDC; `email` and `profile` populate the user's identity claims.
 * (The Express integration additionally requests `offline_access` so it can
 * refresh tokens server-side.)
 */
export const DEFAULT_SCOPES = ['openid', 'email', 'profile'];

/**
 * Configuration shared by every JumpCloud SSO integration, regardless of
 * framework. Both the Next.js and Express entry points accept a superset of
 * this shape.
 */
export interface JumpCloudCommon {
  /**
   * The OIDC issuer URL. Defaults to {@link DEFAULT_ISSUER}. If you override
   * it, keep the trailing slash — see the {@link DEFAULT_ISSUER} docs for why.
   */
  issuer?: string;
  /** OAuth client ID of your JumpCloud OIDC application. */
  clientId: string;
  /**
   * OAuth client secret of your JumpCloud OIDC application. JumpCloud shows
   * this exactly once, at app creation — store it in a secret manager and
   * never commit it.
   */
  clientSecret: string;
  /** OAuth scopes to request. Defaults to {@link DEFAULT_SCOPES}. */
  scopes?: string[];
  /**
   * Name of the ID-token claim that carries JumpCloud group names.
   * Defaults to {@link DEFAULT_GROUPS_CLAIM} (`groups`).
   */
  groupsClaim?: string;
}

/**
 * A {@link JumpCloudCommon} with every optional field resolved to a concrete
 * value. This is what the framework integrations work with internally.
 */
export interface ResolvedJumpCloudCommon extends JumpCloudCommon {
  issuer: string;
  scopes: string[];
  groupsClaim: string;
}

/**
 * Applies the JumpCloud defaults ({@link DEFAULT_ISSUER},
 * {@link DEFAULT_SCOPES}, {@link DEFAULT_GROUPS_CLAIM}) to a partial
 * configuration.
 *
 * @param config - Configuration with at least `clientId` and `clientSecret`.
 * @returns The same configuration with `issuer`, `scopes`, and `groupsClaim`
 * guaranteed to be set.
 */
export function withDefaults(config: JumpCloudCommon): ResolvedJumpCloudCommon {
  return {
    ...config,
    issuer: config.issuer ?? DEFAULT_ISSUER,
    scopes: config.scopes ?? [...DEFAULT_SCOPES],
    groupsClaim: config.groupsClaim ?? DEFAULT_GROUPS_CLAIM,
  };
}
