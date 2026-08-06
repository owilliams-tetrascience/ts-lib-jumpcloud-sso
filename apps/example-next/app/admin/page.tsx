import { hasAnyGroup } from '@tetrascience-npm/jumpcloud-sso/core';
import { redirect } from 'next/navigation';
import { auth } from '../../auth';

const REQUIRED_GROUPS = ['app-admins'];

/**
 * Group-gated page: only members of the JumpCloud group "app-admins".
 *
 * The middleware already answers 403 for non-members, but the page re-checks
 * server-side anyway — middleware is a convenience, not a security boundary.
 */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin?callbackUrl=/admin');
  }

  const groups = session.user.groups ?? [];
  if (!hasAnyGroup(groups, REQUIRED_GROUPS)) {
    return (
      <main>
        <h1>403 — Forbidden</h1>
        <p>
          This page requires membership in the JumpCloud group{' '}
          <code>app-admins</code>. Your groups:{' '}
          <code>{groups.length > 0 ? groups.join(', ') : '(none)'}</code>.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Admin</h1>
      <p>
        Welcome, <strong>{session.user.email}</strong> — you are in{' '}
        <code>app-admins</code>.
      </p>
      <p>Imagine dangerous buttons here.</p>
    </main>
  );
}
