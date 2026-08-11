import { ADMIN_GROUP, ADMIN_GROUPS } from '../../groups';
import { requireSession } from '../../session';

/**
 * Group-gated page: only members of the admin group defined in ../../groups.
 *
 * The middleware already answers 403 for non-members, but the page re-checks
 * server-side anyway — middleware is a convenience, not a security boundary.
 * `requireSession` redirects anonymous visitors to sign-in (round-tripping
 * back here via callbackUrl) and throws to the nearest error boundary when a
 * signed-in user is not in one of the required groups.
 */
export default async function AdminPage() {
  const session = await requireSession({
    groups: ADMIN_GROUPS,
    callbackUrl: '/admin',
  });

  return (
    <main>
      <h1>Admin</h1>
      <p>
        Welcome, <strong>{session.user?.email}</strong> — you are in{' '}
        <code>{ADMIN_GROUP}</code>.
      </p>
      <p>Imagine dangerous buttons here.</p>
    </main>
  );
}
