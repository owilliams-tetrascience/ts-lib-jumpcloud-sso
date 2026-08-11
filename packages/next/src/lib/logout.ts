import {
  buildEndSessionUrl,
  resolvePostLogoutRedirect,
} from '@tetrascience-npm/jumpcloud-sso/core';
import type { NextAuthResult } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { idTokenFromToken } from './claims.js';

/** Options for {@link createSignOutTools}. */
export interface SignOutToolsOptions {
  /** JumpCloud's RP-initiated logout endpoint. */
  endSessionEndpoint: string;
  /** OAuth client ID, used when no ID token is available for the hint. */
  clientId: string;
  /**
   * Where JumpCloud returns the browser after ending the session. Relative
   * paths resolve against this app's own origin; anything off-origin throws.
   *
   * ⚠️ This exact absolute URL must be registered as a post-logout redirect
   * URI on the JumpCloud OIDC application. JumpCloud rejects the whole logout
   * request if it is not — which surfaces as a logout that appears to fail.
   * When omitted, the parameter is left off entirely and JumpCloud falls back
   * to its own default, which always works.
   */
  postLogoutRedirect?: string;
  /**
   * This app's public origin, used to resolve and constrain
   * `postLogoutRedirect`. Defaults to `AUTH_URL`/`NEXTAUTH_URL`, then to the
   * request's own origin.
   */
  baseUrl?: string;
  /**
   * The Auth.js secret(s), for reading the session token. Defaults to
   * `AUTH_SECRET` plus the `AUTH_SECRET_1..3` rotation slots.
   *
   * All of them are tried: during a rotation the cookie in the user's browser
   * may still be sealed with an older one, and failing to read it would
   * quietly drop `id_token_hint` and leave logout showing an interstitial.
   */
  secret?: string | string[];
}

/**
 * Every secret that could have sealed the session cookie, newest first.
 *
 * Auth.js accepts `AUTH_SECRET_1..3` alongside `AUTH_SECRET` so a secret can be
 * rotated without signing everyone out; a cookie minted before the rotation is
 * still valid under the older value.
 */
function candidateSecrets(configured?: string | string[]): string[] {
  if (Array.isArray(configured)) {
    return configured.filter(Boolean);
  }
  if (configured) {
    return [configured];
  }
  return ['AUTH_SECRET', 'AUTH_SECRET_1', 'AUTH_SECRET_2', 'AUTH_SECRET_3']
    .map((name) => process.env[name])
    .filter((value): value is string => Boolean(value));
}

/** What {@link createSignOutTools} returns. */
export interface SignOutTools {
  /**
   * Builds the JumpCloud logout URL for the CURRENT request's session,
   * including `id_token_hint` when available.
   *
   * Useful when you want to run your own cleanup before redirecting. Most
   * callers want {@link signOutEverywhere} instead.
   */
  endSessionUrl(): Promise<string>;
  /**
   * Clears the local Auth.js session AND ends the JumpCloud session, then
   * redirects.
   *
   * Use it as a server action:
   *
   * ```tsx
   * <form action={signOutEverywhere}>
   *   <button type="submit">Sign out</button>
   * </form>
   * ```
   *
   * Order matters: the local session is cleared first, so a failure at
   * JumpCloud can never leave someone signed in locally while believing they
   * signed out. The reverse order fails open.
   */
  signOutEverywhere(): Promise<never>;
}

/**
 * Resolves this app's origin: explicit config, then the Auth.js environment
 * variables, then the incoming request's own host.
 *
 * The request-header fallback is last on purpose. `Host` is attacker-supplied
 * unless a proxy is normalizing it, and this value constrains where logout may
 * redirect — so a configured value always wins.
 */
async function resolveBaseUrl(configured?: string): Promise<string> {
  if (configured) {
    return configured;
  }
  const fromEnv = process.env['AUTH_URL'] ?? process.env['NEXTAUTH_URL'];
  if (fromEnv) {
    return new URL(fromEnv).origin;
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get('host');
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'https';
  if (!host) {
    throw new Error(
      '[jumpcloud-sso] Could not determine this app’s origin for logout. ' +
        'Set AUTH_URL, or pass `baseUrl` to createSignOutTools().',
    );
  }
  return `${proto}://${host}`;
}

/**
 * Builds sign-out helpers that end BOTH sessions — your app's and JumpCloud's.
 *
 * ── WHY AUTH.JS `signOut()` ALONE IS NOT A LOGOUT ───────────────────────────
 * `signOut()` deletes the Auth.js cookie and nothing else. The JumpCloud
 * session is untouched, so the next "Sign in" click sails through the OIDC
 * flow with no prompt and lands the user straight back in. On a personal
 * laptop that is a confusing no-op; on a shared or kiosk machine it hands the
 * next person at the keyboard the previous user's account, with no credential
 * required. RP-initiated logout is what actually ends it.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The Express integration gets this for free via express-openid-connect's
 * `idpLogout: true`; on Next.js it has to be wired explicitly, which is what
 * this does.
 *
 * @example
 * ```ts
 * // auth.ts — `signOutEverywhere` comes back from the factory already wired.
 * export const { handlers, auth, signOut, signOutEverywhere } =
 *   createJumpCloudAuth({ ...resolveEnv() });
 * ```
 *
 * @param auth - Unused today, accepted so the signature matches the other
 * `create*Tools` factories and can grow without a breaking change.
 * @param signOut - The `signOut` function from your `NextAuth()` result.
 * @param options - See {@link SignOutToolsOptions}.
 */
export function createSignOutTools(
  auth: NextAuthResult['auth'],
  signOut: NextAuthResult['signOut'],
  options: SignOutToolsOptions,
): SignOutTools {
  /**
   * Digs the raw ID token out of the session cookie.
   *
   * Reads the JWT rather than the session, because `id_token_hint` needs the
   * original ID token string and that never reaches the session object.
   *
   * `secureCookie` decides both which cookie name is read
   * (`__Secure-authjs.session-token` vs `authjs.session-token`) and the salt
   * the JWT is sealed with, so a wrong guess silently yields `null`. The
   * origin's scheme is the right guess almost always, but a proxy-terminated
   * TLS setup or an explicit `useSecureCookies` can invert it — so the other
   * variant is tried too rather than quietly degrading logout.
   */
  async function readIdToken(secure: boolean): Promise<string | undefined> {
    const requestHeaders = await headers();
    const secrets = candidateSecrets(options.secret);
    if (secrets.length === 0) {
      return undefined;
    }
    for (const secureCookie of [secure, !secure]) {
      const token = await getToken({
        req: { headers: requestHeaders },
        secret: secrets,
        secureCookie,
      });
      const idToken = token ? idTokenFromToken(token) : undefined;
      if (idToken) {
        return idToken;
      }
    }
    return undefined;
  }

  async function endSessionUrl(): Promise<string> {
    const baseUrl = await resolveBaseUrl(options.baseUrl);

    return buildEndSessionUrl({
      endSessionEndpoint: options.endSessionEndpoint,
      clientId: options.clientId,
      idToken: await readIdToken(baseUrl.startsWith('https://')),
      postLogoutRedirectUri: options.postLogoutRedirect
        ? resolvePostLogoutRedirect(options.postLogoutRedirect, baseUrl)
        : undefined,
      baseUrl,
    });
  }

  return {
    endSessionUrl,
    async signOutEverywhere(): Promise<never> {
      // Compute the URL first — it needs the ID token that signOut() is about
      // to delete.
      const target = await endSessionUrl();
      await signOut({ redirect: false });
      // `redirect()` throws NEXT_REDIRECT rather than returning, so this is
      // the end of the road — typing it `never` keeps callers from writing
      // unreachable code after the call.
      redirect(target);
    },
  };
}
