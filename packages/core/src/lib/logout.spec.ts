import { describe, expect, it } from 'vitest';
import {
  buildEndSessionUrl,
  DEFAULT_END_SESSION_ENDPOINT,
  resolvePostLogoutRedirect,
} from './logout.js';

const APP = 'https://ts-ux-roadmap.vercel.app';

describe('resolvePostLogoutRedirect', () => {
  it('resolves a relative path against the app origin', () => {
    expect(resolvePostLogoutRedirect('/goodbye', APP)).toBe(`${APP}/goodbye`);
  });

  it('accepts an absolute URL on the same origin', () => {
    expect(resolvePostLogoutRedirect(`${APP}/bye?x=1`, APP)).toBe(
      `${APP}/bye?x=1`,
    );
  });

  it('accepts the bare origin', () => {
    expect(resolvePostLogoutRedirect(APP, APP)).toBe(`${APP}/`);
  });

  describe('refuses to leave the app origin', () => {
    // Every one of these defeats a substring/startsWith/prefix check, which
    // is why the comparison is on the PARSED origin. A post-logout redirect
    // is attacker-attractive precisely because the user has just been told
    // they are signed out and is primed to re-enter credentials.
    it.each([
      // Protocol-relative: resolves to https://evil.example, not a path.
      ['//evil.example', '//evil.example'],
      // Suffix match — the classic allowlist bug.
      ['host-suffix', 'https://ts-ux-roadmap.vercel.app.evil.example'],
      // Userinfo: everything before @ is a username, the host is evil.
      ['userinfo', 'https://ts-ux-roadmap.vercel.app@evil.example'],
      ['userinfo with password', 'https://user:pass@evil.example'],
      // Backslashes are normalized to slashes by WHATWG URL parsing.
      ['backslash', '/\\evil.example'],
      ['double backslash', '\\\\evil.example'],
      // Scheme downgrade to the same host is still a different origin.
      ['scheme downgrade', 'http://ts-ux-roadmap.vercel.app/bye'],
      // Different port is a different origin.
      ['port', 'https://ts-ux-roadmap.vercel.app:8443/bye'],
      // Non-http schemes.
      ['javascript', 'javascript:alert(1)'],
      ['data', 'data:text/html,<script>alert(1)</script>'],
    ])('rejects %s', (_label, target) => {
      expect(() => resolvePostLogoutRedirect(target, APP)).toThrowError(
        /Refusing to use|not a valid URL/,
      );
    });
  });

  it('does NOT reject a percent-encoded path that stays on-origin', () => {
    // %2f%2fevil.example stays a path segment once resolved — encoded input is
    // not automatically hostile, and rejecting it would break real callers.
    expect(resolvePostLogoutRedirect('/%2f%2fevil.example', APP)).toBe(
      `${APP}/%2f%2fevil.example`,
    );
  });

  it('throws on an unparseable baseUrl rather than defaulting', () => {
    expect(() => resolvePostLogoutRedirect('/bye', 'not-a-url')).toThrowError(
      /`baseUrl` is not a valid URL/,
    );
  });
});

describe('buildEndSessionUrl', () => {
  it('targets the JumpCloud end-session endpoint by default', () => {
    expect(buildEndSessionUrl()).toBe(`${DEFAULT_END_SESSION_ENDPOINT}`);
  });

  it('matches the endpoint JumpCloud publishes in its discovery document', () => {
    expect(DEFAULT_END_SESSION_ENDPOINT).toBe(
      'https://oauth.id.jumpcloud.com/oauth2/sessions/logout',
    );
  });

  it('sends id_token_hint when the ID token is available', () => {
    const url = new URL(buildEndSessionUrl({ idToken: 'header.payload.sig' }));
    expect(url.searchParams.get('id_token_hint')).toBe('header.payload.sig');
  });

  it('falls back to client_id when there is no ID token', () => {
    // Without either, JumpCloud cannot validate post_logout_redirect_uri
    // against the client's registered list.
    const url = new URL(buildEndSessionUrl({ clientId: 'client-1' }));
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.has('id_token_hint')).toBe(false);
  });

  it('prefers id_token_hint over client_id when both are available', () => {
    const url = new URL(
      buildEndSessionUrl({ idToken: 'tok', clientId: 'client-1' }),
    );
    expect(url.searchParams.get('id_token_hint')).toBe('tok');
    expect(url.searchParams.has('client_id')).toBe(false);
  });

  it('omits post_logout_redirect_uri entirely when unset', () => {
    // Sending an unregistered URI makes JumpCloud reject the whole logout, so
    // "no opinion" must mean "no parameter", not an invented default.
    const url = new URL(buildEndSessionUrl({ idToken: 'tok' }));
    expect(url.searchParams.has('post_logout_redirect_uri')).toBe(false);
  });

  it('resolves a relative post-logout redirect against baseUrl', () => {
    const url = new URL(
      buildEndSessionUrl({ postLogoutRedirectUri: '/bye', baseUrl: APP }),
    );
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(`${APP}/bye`);
  });

  it('refuses an off-origin post-logout redirect', () => {
    expect(() =>
      buildEndSessionUrl({
        postLogoutRedirectUri: 'https://evil.example',
        baseUrl: APP,
      }),
    ).toThrowError(/Refusing to use/);
  });
});
