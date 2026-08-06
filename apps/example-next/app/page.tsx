import { getSessionUser, SignedIn, SignedOut } from '../session';

/**
 * Public home page — the middleware lists '/' in publicPaths, so this renders
 * for everyone. It still reads the session (if any) to greet signed-in users,
 * via the createSessionTools conveniences instead of raw auth() calls.
 */
export default async function HomePage() {
  const me = await getSessionUser();

  return (
    <main>
      <h1>JumpCloud SSO — Next.js example</h1>
      <p>This page is public.</p>
      <SignedIn>
        <p>
          Signed in as <strong>{me?.user.email}</strong>
          {me && me.groups.length > 0 ? (
            <>
              {' '}
              (groups: <code>{me.groups.join(', ')}</code>)
            </>
          ) : null}
        </p>
        <SignedIn
          groups={['app-admins']}
          fallback={<p>The admin panel is hidden — you are not an admin.</p>}
        >
          <p>
            You are an admin — try the <a href="/admin">admin page</a>.
          </p>
        </SignedIn>
        <p>
          <a href="/api/auth/signout">Sign out</a> — this also ends your
          JumpCloud session.
        </p>
      </SignedIn>
      <SignedOut>
        <p>
          <a href="/api/auth/signin">Sign in with JumpCloud</a> — or just visit
          a protected page and you&apos;ll be bounced there automatically.
        </p>
      </SignedOut>
    </main>
  );
}
