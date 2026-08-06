import { redirect } from 'next/navigation';
import { auth } from '../../auth';

/**
 * Protected page: any signed-in user may view it.
 *
 * The middleware already redirects anonymous visitors, but middleware is a
 * convenience, not a security boundary — so the page re-checks the session
 * server-side before rendering anything sensitive.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin?callbackUrl=/dashboard');
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>
        Hello <strong>{session.user.name ?? session.user.email}</strong> — you
        are signed in via JumpCloud.
      </p>
      <h2>Your JumpCloud groups</h2>
      {session.user.groups && session.user.groups.length > 0 ? (
        <ul>
          {session.user.groups.map((group) => (
            <li key={group}>
              <code>{group}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          You are in no JumpCloud groups (or none are bound to this app&apos;s
          group attribute).
        </p>
      )}
    </main>
  );
}
