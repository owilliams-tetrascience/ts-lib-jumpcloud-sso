import { notFound } from 'next/navigation';
import { ADMIN_GROUP, GROUPS_CLAIM } from '../../groups';
import { requireSession } from '../../session';

/**
 * Development-only claim inspector: what JumpCloud actually put in the ID
 * token, what ended up on the session, and whether that satisfies the admin
 * gate — the three things you need to debug "it says I'm not in the group".
 *
 * DEV ONLY. These are the signed-in user's directory attributes in plain
 * text; a deployed app has no business rendering them. `next build` sets
 * NODE_ENV=production, so this 404s in every deployment, and auth.ts stops
 * putting the claims on the session there in the first place.
 *
 * Not shown here, on purpose: the session cookie's own JWT and any JumpCloud
 * access/ID token string. Those are bearer credentials — printing one into a
 * page (and your terminal, and your screen-share) is how it leaks. The
 * decoded claims below are what actually drive gating.
 */
export default async function DebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const session = await requireSession({ callbackUrl: '/debug' });
  const claims = (session as { idTokenClaims?: Record<string, unknown> })
    .idTokenClaims;
  const groups = session.user?.groups ?? [];
  const claimValue = claims?.[GROUPS_CLAIM];

  // The claim arrived but never reached the session. Groups are written to
  // the JWT only at sign-in, so this is what a session cookie minted before
  // the current code looks like — the claims are in the cookie, the groups
  // aren't, and no amount of reloading or restarting fixes it.
  const staleSession = claimValue !== undefined && groups.length === 0;

  return (
    <main>
      <h1>Claim debug</h1>
      <p>
        Development only — this page 404s when <code>NODE_ENV=production</code>.
      </p>

      {staleSession ? (
        <p
          style={{
            border: '2px solid #b00',
            padding: '0.75rem',
            background: '#fff5f5',
          }}
        >
          <strong>Your session is stale — sign out and back in.</strong> The ID
          token carried <code>{GROUPS_CLAIM}</code>, but no groups reached the
          session. Groups are copied onto the JWT <em>only at sign-in</em>, so a
          cookie minted before the current code (or before you were added to the
          group) keeps its old, empty list forever.{' '}
          <a href="/api/auth/signout">Sign out</a>, then sign back in and reload
          this page.
        </p>
      ) : null}

      <h2>Group gating</h2>
      <table>
        <tbody>
          <tr>
            <td>Configured claim</td>
            <td>
              <code>{GROUPS_CLAIM}</code>
            </td>
          </tr>
          <tr>
            <td>Claim present in ID token</td>
            <td>
              <code>{claimValue === undefined ? 'NO' : 'yes'}</code>
              {claimValue === undefined && claims !== undefined ? (
                <>
                  {' '}
                  — the token carried:{' '}
                  <code>{Object.keys(claims).join(', ')}</code>
                </>
              ) : null}
            </td>
          </tr>
          <tr>
            <td>Raw claim type</td>
            <td>
              <code>
                {Array.isArray(claimValue) ? 'array' : typeof claimValue}
              </code>{' '}
              (JumpCloud sends a bare string for exactly one group)
            </td>
          </tr>
          <tr>
            <td>Groups on session</td>
            <td>
              <code>{groups.length > 0 ? groups.join(', ') : '(none)'}</code>
            </td>
          </tr>
          <tr>
            <td>
              In <code>{ADMIN_GROUP}</code>
            </td>
            <td>
              <code>{groups.includes(ADMIN_GROUP) ? 'yes' : 'NO'}</code> —
              matching is exact and case-sensitive
            </td>
          </tr>
        </tbody>
      </table>

      <h2>ID token claims, decoded</h2>
      {claims === undefined ? (
        <p>
          No claims captured. They are only stored at sign-in — sign out and
          back in, since an existing session cookie predates this page.
        </p>
      ) : (
        <pre
          style={{ overflowX: 'auto', background: '#f5f5f5', padding: '1rem' }}
        >
          {JSON.stringify(claims, null, 2)}
        </pre>
      )}

      <h2>Session</h2>
      <pre
        style={{ overflowX: 'auto', background: '#f5f5f5', padding: '1rem' }}
      >
        {JSON.stringify(session, null, 2)}
      </pre>
    </main>
  );
}
