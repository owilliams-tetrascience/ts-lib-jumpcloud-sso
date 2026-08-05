import { createAuthMiddleware } from '@tetrascience-npm/jumpcloud-sso/next';
import { auth, routeGroups } from './auth';

/**
 * Route protection:
 * - `/` (home) is public;
 * - everything else requires a JumpCloud session;
 * - `/admin` additionally requires the `app-admins` group (403 otherwise).
 *
 * Middleware is a convenience, not a security boundary — each protected page
 * ALSO re-checks the session server-side (see app/dashboard/page.tsx and
 * app/admin/page.tsx).
 */
export default createAuthMiddleware(auth, {
  publicPaths: ['/'],
  routeGroups,
});

export const config = {
  // Run on everything except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
