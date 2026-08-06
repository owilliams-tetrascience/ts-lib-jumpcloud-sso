import { auth } from '../auth';

/**
 * Public home page — the middleware lists '/' in publicPaths, so this renders
 * for everyone. It still reads the session (if any) to greet signed-in users.
 */
export default async function HomePage() {
  const session = await auth();

  return (
    <main>
      <h1>JumpCloud SSO — Next.js example</h1>
      <p>This page is public.</p>
      {session?.user ? (
        <>
          <p>
            Signed in as <strong>{session.user.email}</strong>
            {session.user.groups && session.user.groups.length > 0 ? (
              <>
                {' '}
                (groups: <code>{session.user.groups.join(', ')}</code>)
              </>
            ) : null}
          </p>
          <p>
            <a href="/api/auth/signout">Sign out</a> — this also ends your
            JumpCloud session.
          </p>
        </>
      ) : (
        <p>
          <a href="/api/auth/signin">Sign in with JumpCloud</a> — or just visit
          a protected page and you&apos;ll be bounced there automatically.
        </p>
      )}
    </main>
  );
}
