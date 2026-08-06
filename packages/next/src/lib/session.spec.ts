import type { NextAuthResult, Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// next/navigation's redirect() only works inside a real Next.js request
// scope; replace it with a throwing sentinel so redirects are assertable.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { createSessionTools } = await import('./session.js');

/** Builds a fake `auth` that resolves the given session on a bare call. */
function fakeAuth(session: Session | null): NextAuthResult['auth'] {
  return (async () => session) as unknown as NextAuthResult['auth'];
}

function sessionWith(groups: string[]): Session {
  return {
    user: { email: 'user@tetrascience.com', groups },
    expires: '2099-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireSession', () => {
  it('returns the session for a signed-in user', async () => {
    const { requireSession } = createSessionTools(fakeAuth(sessionWith([])));
    const session = await requireSession();
    expect(session.user?.email).toBe('user@tetrascience.com');
  });

  it('redirects unauthenticated users to the Auth.js sign-in page', async () => {
    const { requireSession } = createSessionTools(fakeAuth(null));
    await expect(requireSession()).rejects.toThrowError(
      'REDIRECT:/api/auth/signin',
    );
  });

  it('appends callbackUrl when provided', async () => {
    const { requireSession } = createSessionTools(fakeAuth(null));
    await expect(
      requireSession({ callbackUrl: '/admin?tab=users' }),
    ).rejects.toThrowError(
      'REDIRECT:/api/auth/signin?callbackUrl=%2Fadmin%3Ftab%3Dusers',
    );
  });

  it('honors a custom signInPath', async () => {
    const { requireSession } = createSessionTools(fakeAuth(null), {
      signInPath: '/welcome',
    });
    await expect(requireSession()).rejects.toThrowError('REDIRECT:/welcome');
  });

  it('passes when the user is in one of the allowed groups', async () => {
    const { requireSession } = createSessionTools(
      fakeAuth(sessionWith(['app-admins', 'everyone'])),
    );
    await expect(
      requireSession({ groups: ['app-admins'] }),
    ).resolves.toBeDefined();
  });

  it('throws on group failure by default', async () => {
    const { requireSession } = createSessionTools(
      fakeAuth(sessionWith(['everyone'])),
    );
    await expect(
      requireSession({ groups: ['app-admins'] }),
    ).rejects.toThrowError(/app-admins/);
  });

  it('redirects on group failure when forbiddenPath is configured', async () => {
    const { requireSession } = createSessionTools(
      fakeAuth(sessionWith(['everyone'])),
      { forbiddenPath: '/denied' },
    );
    await expect(
      requireSession({ groups: ['app-admins'] }),
    ).rejects.toThrowError('REDIRECT:/denied');
  });
});

describe('getSessionUser', () => {
  it('resolves user and groups when signed in', async () => {
    const { getSessionUser } = createSessionTools(
      fakeAuth(sessionWith(['engineers'])),
    );
    await expect(getSessionUser()).resolves.toEqual({
      user: { email: 'user@tetrascience.com', groups: ['engineers'] },
      groups: ['engineers'],
    });
  });

  it('resolves null when signed out', async () => {
    const { getSessionUser } = createSessionTools(fakeAuth(null));
    await expect(getSessionUser()).resolves.toBeNull();
  });
});

describe('SignedIn / SignedOut', () => {
  it('SignedIn renders children for a signed-in user', async () => {
    const { SignedIn } = createSessionTools(fakeAuth(sessionWith([])));
    await expect(SignedIn({ children: 'secret' })).resolves.toBe('secret');
  });

  it('SignedIn renders the fallback when signed out', async () => {
    const { SignedIn } = createSessionTools(fakeAuth(null));
    await expect(
      SignedIn({ children: 'secret', fallback: 'please sign in' }),
    ).resolves.toBe('please sign in');
    await expect(SignedIn({ children: 'secret' })).resolves.toBeNull();
  });

  it('SignedIn enforces groups', async () => {
    const { SignedIn } = createSessionTools(
      fakeAuth(sessionWith(['everyone'])),
    );
    await expect(
      SignedIn({
        children: 'admin ui',
        groups: ['app-admins'],
        fallback: 'no',
      }),
    ).resolves.toBe('no');
    await expect(
      SignedIn({ children: 'general ui', groups: ['everyone'] }),
    ).resolves.toBe('general ui');
  });

  it('SignedOut renders children only when signed out', async () => {
    const signedOutTools = createSessionTools(fakeAuth(null));
    await expect(
      signedOutTools.SignedOut({ children: 'sign-in banner' }),
    ).resolves.toBe('sign-in banner');

    const signedInTools = createSessionTools(fakeAuth(sessionWith([])));
    await expect(
      signedInTools.SignedOut({ children: 'sign-in banner' }),
    ).resolves.toBeNull();
  });
});
