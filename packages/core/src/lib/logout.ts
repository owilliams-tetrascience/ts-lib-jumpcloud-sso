/**
 * JumpCloud's RP-initiated logout (end session) endpoint, as published in its
 * discovery document at
 * `https://oauth.id.jumpcloud.com/.well-known/openid-configuration`.
 *
 * Clearing your app's own session is only half a logout: the JumpCloud session
 * outlives it, so the next sign-in click silently re-authenticates the same
 * user with no prompt. On a shared machine that reads as "logout didn't work",
 * and it hands the next person at the keyboard the previous user's account.
 */
export const DEFAULT_END_SESSION_ENDPOINT =
  'https://oauth.id.jumpcloud.com/oauth2/sessions/logout';

/** Inputs for {@link buildEndSessionUrl}. */
export interface EndSessionOptions {
  /** Defaults to {@link DEFAULT_END_SESSION_ENDPOINT}. */
  endSessionEndpoint?: string;
  /**
   * The raw ID token from sign-in. JumpCloud uses it to identify the session
   * being ended and to skip its "are you sure?" interstitial. Omitted from the
   * URL when absent — logout still works, it just may prompt.
   */
  idToken?: string;
  /** OAuth client ID, sent when there is no `idToken` to identify the client. */
  clientId?: string;
  /**
   * Where JumpCloud sends the browser once the session is gone. MUST be
   * registered as a post-logout redirect URI on the JumpCloud OIDC
   * application — JumpCloud rejects the whole request otherwise, which
   * surfaces as a failed logout. Omit it and JumpCloud uses its own default.
   */
  postLogoutRedirectUri?: string;
  /**
   * The app's public origin. When given, `postLogoutRedirectUri` must be on
   * it; anything else throws. This is the check that stops a caller from
   * turning logout into an open redirect by passing a URL through from a
   * query parameter.
   */
  baseUrl?: string;
}

/**
 * Resolves a post-logout redirect against `baseUrl` and refuses to leave it.
 *
 * Accepts a path (`/goodbye`) or an absolute URL, and returns an absolute URL.
 * Anything that resolves off-origin throws rather than being silently dropped,
 * because a logout link that quietly ignores where it was told to go is how a
 * broken redirect allowlist goes unnoticed.
 *
 * Handles the shapes that defeat naive prefix checks: `//evil.example`,
 * `https://trusted@evil.example`, backslash variants, and scheme changes are
 * all compared on the parsed origin, never on string prefixes.
 *
 * @throws Error when the target resolves to a different origin than `baseUrl`.
 */
export function resolvePostLogoutRedirect(
  target: string,
  baseUrl: string,
): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error(
      `[jumpcloud-sso] \`baseUrl\` is not a valid URL: ${baseUrl}`,
    );
  }
  let resolved: URL;
  try {
    resolved = new URL(target, base);
  } catch {
    throw new Error(
      `[jumpcloud-sso] Post-logout redirect is not a valid URL: ${target}`,
    );
  }
  if (resolved.origin !== base.origin) {
    throw new Error(
      `[jumpcloud-sso] Refusing to use "${target}" as a post-logout redirect: ` +
        `it resolves to ${resolved.origin}, not this app's origin ` +
        `(${base.origin}). Pass a path or a URL on your own origin — never a ` +
        'value taken from a query parameter or request header.',
    );
  }
  return resolved.toString();
}

/**
 * Builds the JumpCloud RP-initiated logout URL.
 *
 * Send the browser here AFTER clearing the local session, so a failure at
 * JumpCloud cannot leave the user signed in locally while believing they
 * signed out.
 *
 * @param options - See {@link EndSessionOptions}.
 * @returns An absolute URL to redirect the browser to.
 * @throws Error when `postLogoutRedirectUri` is off-origin from `baseUrl`.
 */
export function buildEndSessionUrl(options: EndSessionOptions = {}): string {
  const url = new URL(
    options.endSessionEndpoint ?? DEFAULT_END_SESSION_ENDPOINT,
  );

  if (options.idToken) {
    url.searchParams.set('id_token_hint', options.idToken);
  } else if (options.clientId) {
    // Without an id_token_hint the endpoint still needs to know which client
    // is asking, in order to validate post_logout_redirect_uri against that
    // client's registered list.
    url.searchParams.set('client_id', options.clientId);
  }

  if (options.postLogoutRedirectUri) {
    url.searchParams.set(
      'post_logout_redirect_uri',
      options.baseUrl
        ? resolvePostLogoutRedirect(
            options.postLogoutRedirectUri,
            options.baseUrl,
          )
        : options.postLogoutRedirectUri,
    );
  }

  return url.toString();
}
