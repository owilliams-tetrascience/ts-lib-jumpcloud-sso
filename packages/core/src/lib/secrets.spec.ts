import { describe, expect, it } from 'vitest';
import { assertStrongSecret, MIN_SECRET_LENGTH } from './secrets.js';

const source = {
  name: 'sessionSecret',
  generateWith: 'openssl rand -hex 32',
};

/** What `openssl rand -hex 32` produces: 64 hex characters. */
const REAL_SECRET =
  '3f8a1c9e4b7d2065f1a3c8e590b4d7263a9f0c1e8b5d4a7f2c6e930184b5d7a2';

describe('assertStrongSecret', () => {
  it('accepts a generated secret', () => {
    expect(() => assertStrongSecret(REAL_SECRET, source)).not.toThrow();
  });

  it('accepts a secret exactly at the minimum length', () => {
    expect(() =>
      assertStrongSecret(REAL_SECRET.slice(0, MIN_SECRET_LENGTH), source),
    ).not.toThrow();
  });

  it.each([undefined, ''])('rejects a missing secret (%p)', (value) => {
    expect(() => assertStrongSecret(value, source)).toThrowError(/is required/);
  });

  it('rejects a secret one character below the minimum', () => {
    expect(() =>
      assertStrongSecret(REAL_SECRET.slice(0, MIN_SECRET_LENGTH - 1), source),
    ).toThrowError(/at least 32 are required/);
  });

  it('rejects the 8-character secret express-openid-connect would accept', () => {
    // express-openid-connect validates `Joi.string().min(8)`, so "hunter22"
    // boots a real deployment today. That secret encrypts a cookie whose
    // contents ARE the authentication and authorization decision.
    expect(() => assertStrongSecret('hunter22', source)).toThrowError(
      /8 characters/,
    );
  });

  it.each([
    'changeme-changeme-changeme-changeme',
    'placeholder-secret-value-goes-here-1',
    'my-TODO-secret-abcdefghijklmnopqrstu',
  ])('rejects the padded-out placeholder %p', (value) => {
    expect(() => assertStrongSecret(value, source)).toThrowError(
      /placeholder rather than a generated secret/,
    );
  });

  it('rejects a value that reaches the length by repetition', () => {
    // Long enough to pass a naive length check, ~1 bit of entropy.
    expect(() => assertStrongSecret('a'.repeat(64), source)).toThrowError(
      /distinct characters/,
    );
    expect(() => assertStrongSecret('ab'.repeat(32), source)).toThrowError(
      /distinct characters/,
    );
  });

  it('names the offending option and the generator in the error', () => {
    expect(() => assertStrongSecret('short', source)).toThrowError(
      /`sessionSecret`.*openssl rand -hex 32/s,
    );
  });

  it('appends the caller-supplied note', () => {
    expect(() =>
      assertStrongSecret('short', {
        ...source,
        note: 'Not the client secret.',
      }),
    ).toThrowError(/Not the client secret\./);
  });
});
