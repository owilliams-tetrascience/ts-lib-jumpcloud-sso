/**
 * The minimum length, in characters, this package accepts for a cookie or JWT
 * signing secret.
 *
 * 32 is the length of `openssl rand -hex 16` and the floor below which a
 * secret is worth attacking offline. It is deliberately stricter than what the
 * underlying libraries enforce: express-openid-connect accepts any string of 8
 * characters or more, and Auth.js enforces no minimum at all — it runs
 * whatever it is given through HKDF, which stretches a weak secret without
 * adding entropy to it.
 *
 * The recommended generators (`openssl rand -hex 32`, `npx auth secret`) both
 * produce comfortably more than this.
 */
export const MIN_SECRET_LENGTH = 32;

/**
 * Values that show up in copy-pasted configuration and would otherwise sail
 * past a pure length check once padded out. Compared case-insensitively as
 * substrings, so `my-changeme-secret-aaaaaaaaaaaaaaaa` is rejected too.
 */
const PLACEHOLDER_FRAGMENTS = [
  'changeme',
  'change-me',
  'placeholder',
  'your-secret',
  'yoursecret',
  'replace-me',
  'replaceme',
  'insert-secret',
  'todo',
  'xxxxxxxx',
  'secret-goes-here',
];

/**
 * The number of distinct characters a secret must contain. Catches a value
 * that reaches {@link MIN_SECRET_LENGTH} by repetition (`'a'.repeat(32)`,
 * `'abababab...'`) rather than by entropy. Hex output uses 16 symbols and
 * base64 uses 64, so any real generator clears this by a wide margin.
 */
const MIN_DISTINCT_CHARACTERS = 8;

/** Where a rejected secret came from, so the error can name it. */
export interface SecretSource {
  /** How the caller refers to it, e.g. `sessionSecret` or `AUTH_SECRET`. */
  name: string;
  /** The command that produces an acceptable value. */
  generateWith: string;
  /** Appended to the error — what this secret is NOT, for the classic mix-up. */
  note?: string;
}

/**
 * Rejects a secret that is missing, too short, an obvious placeholder, or too
 * repetitive to carry real entropy.
 *
 * ── WHY THIS IS NOT MERELY HYGIENE ──────────────────────────────────────────
 * In both integrations this secret IS the session. Express keeps the whole
 * OIDC token set inside an encrypted cookie and answers
 * `req.oidc.isAuthenticated()` straight from it; Next.js keeps a signed JWT
 * carrying `groups`. Anyone who recovers the secret can mint a cookie naming
 * any user and claiming any JumpCloud group, and every guard in this package —
 * `requireAuth`, `requireGroup`, `requireSession`, the middleware — will honor
 * it. There is no IdP round-trip left to catch the forgery.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * @param value - The secret as configured.
 * @param source - How to name it in the error (see {@link SecretSource}).
 * @throws Error when the secret is absent or fails any strength check.
 */
export function assertStrongSecret(
  value: string | undefined,
  source: SecretSource,
): asserts value is string {
  const suffix =
    `Generate one with \`${source.generateWith}\`.` +
    (source.note ? ` ${source.note}` : '');

  if (!value) {
    throw new Error(
      `[jumpcloud-sso] \`${source.name}\` is required. ${suffix}`,
    );
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[jumpcloud-sso] \`${source.name}\` is ${value.length} characters; ` +
        `at least ${MIN_SECRET_LENGTH} are required. This secret signs and ` +
        'encrypts the session cookie, so a short one can be recovered offline ' +
        'and used to forge a session for any user, in any JumpCloud group. ' +
        suffix,
    );
  }
  const lowered = value.toLowerCase();
  const placeholder = PLACEHOLDER_FRAGMENTS.find((fragment) =>
    lowered.includes(fragment),
  );
  if (placeholder !== undefined) {
    throw new Error(
      `[jumpcloud-sso] \`${source.name}\` contains "${placeholder}", so it is ` +
        'a placeholder rather than a generated secret. ' +
        suffix,
    );
  }
  if (new Set(value).size < MIN_DISTINCT_CHARACTERS) {
    throw new Error(
      `[jumpcloud-sso] \`${source.name}\` is long enough but uses only ` +
        `${new Set(value).size} distinct characters, so it carries far less ` +
        'entropy than its length suggests. ' +
        suffix,
    );
  }
}
