import {
  assertGatedGroups,
  hasAnyGroup,
} from '@tetrascience-npm/jumpcloud-sso/core';
import type { NextAuthResult, Session } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

/** Options for {@link createSessionTools}. */
export interface SessionToolsOptions {
  /**
   * Where {@link SessionTools.requireSession} sends unauthenticated users.
   * Defaults to the Auth.js sign-in page, `/api/auth/signin`, which forwards
   * straight to JumpCloud when it is the only provider.
   */
  signInPath?: string;
  /**
   * Where {@link SessionTools.requireSession} sends signed-in users who fail
   * a `groups` check. When omitted, a group failure throws instead (rendering
   * the nearest `error.tsx`) — a silent redirect can hide misconfigured
   * group names.
   */
  forbiddenPath?: string;
}

/** Options for {@link SessionTools.requireSession}. */
export interface RequireSessionOptions {
  /**
   * JumpCloud group NAMES (not IDs); membership in any one suffices.
   *
   * Omit it for "any signed-in user". An empty array throws rather than
   * meaning the same thing — it is nearly always an unresolved config value,
   * and silently admitting everyone through a check that reads as a gate is
   * the wrong direction to fail.
   */
  groups?: string[];
  /**
   * Sent along to the sign-in page as `callbackUrl` so the user lands back
   * here after login. Server components don't know their own URL, so pass
   * the page's path explicitly (e.g. `'/admin/settings'`) if you want the
   * round-trip; without it Auth.js falls back to its default callback.
   */
  callbackUrl?: string;
}

/** Props for the {@link SessionTools.SignedIn} component. */
export interface SignedInProps {
  /** Rendered when the user is signed in (and passes `groups`, if given). */
  children: ReactNode;
  /**
   * JumpCloud group NAMES; membership in any one suffices. Omit for "any
   * signed-in user"; an empty array throws.
   */
  groups?: string[];
  /** Rendered instead of `children` when the check fails. Default: nothing. */
  fallback?: ReactNode;
}

/** Props for the {@link SessionTools.SignedOut} component. */
export interface SignedOutProps {
  /** Rendered when the user is NOT signed in. */
  children: ReactNode;
}

/** What {@link createSessionTools} returns. */
export interface SessionTools {
  /**
   * Session check for server components, pages, layouts, and server actions:
   * returns the session, or redirects to sign-in when there is none. With
   * `groups`, additionally enforces JumpCloud group membership.
   *
   * ⚠️ Like the middleware, this is enforced server-side per render — use it
   * in every page/layout that shows something sensitive rather than relying
   * on middleware alone.
   */
  requireSession(options?: RequireSessionOptions): Promise<Session>;
  /**
   * Non-redirecting variant for places that want to branch rather than
   * bounce: resolves `{ user, groups }` when signed in, `null` otherwise.
   */
  getSessionUser(): Promise<{
    user: NonNullable<Session['user']>;
    groups: string[];
  } | null>;
  /**
   * Server component that renders its children only for signed-in users
   * (optionally gated to JumpCloud `groups`), else the `fallback`.
   */
  SignedIn(props: SignedInProps): Promise<ReactNode>;
  /** Server component that renders its children only for signed-OUT users. */
  SignedOut(props: SignedOutProps): Promise<ReactNode>;
}

/**
 * Builds session-check conveniences bound to your app's `auth` function:
 * a `requireSession` guard for pages/layouts/actions, a `getSessionUser`
 * reader, and `SignedIn` / `SignedOut` server components for conditional UI.
 *
 * @example
 * ```ts
 * // session.ts (next to your auth.ts)
 * import { createSessionTools } from '@tetrascience-npm/jumpcloud-sso/next';
 * import { auth } from './auth';
 *
 * export const { requireSession, getSessionUser, SignedIn, SignedOut } =
 *   createSessionTools(auth);
 * ```
 *
 * ```tsx
 * // app/admin/page.tsx
 * import { requireSession } from '../../session';
 *
 * export default async function AdminPage() {
 *   const session = await requireSession({
 *     groups: ['app-admins'],
 *     callbackUrl: '/admin',
 *   });
 *   return <h1>Hello {session.user?.email}</h1>;
 * }
 * ```
 *
 * ```tsx
 * // Anywhere in a server-rendered tree:
 * <SignedIn groups={['app-admins']} fallback={<p>Admins only.</p>}>
 *   <AdminPanel />
 * </SignedIn>
 * ```
 *
 * @param auth - The `auth` function returned by `createJumpCloudAuth` (or
 * any `NextAuth()` result).
 * @param options - Sign-in and forbidden destinations.
 */
export function createSessionTools(
  auth: NextAuthResult['auth'],
  options: SessionToolsOptions = {},
): SessionTools {
  const signInPath = options.signInPath ?? '/api/auth/signin';

  async function readSession(): Promise<Session | null> {
    const session = await auth();
    return session?.user ? session : null;
  }

  function passesGroups(
    session: Session,
    groups: string[] | undefined,
  ): boolean {
    return hasAnyGroup(session.user?.groups ?? [], groups ?? []);
  }

  return {
    async requireSession(opts: RequireSessionOptions = {}): Promise<Session> {
      // Validated before the session is read, so a bad group list fails the
      // same way for signed-out users as for signed-in ones.
      assertGatedGroups(opts.groups, 'requireSession({ groups })');
      const session = await readSession();
      if (!session) {
        const target = opts.callbackUrl
          ? `${signInPath}?callbackUrl=${encodeURIComponent(opts.callbackUrl)}`
          : signInPath;
        redirect(target);
      }
      if (!passesGroups(session, opts.groups)) {
        if (options.forbiddenPath) {
          redirect(options.forbiddenPath);
        }
        throw new Error(
          `[jumpcloud-sso] Forbidden: requires membership in one of the ` +
            `JumpCloud groups: ${(opts.groups ?? []).join(', ')}.`,
        );
      }
      return session;
    },

    async getSessionUser() {
      const session = await readSession();
      if (!session?.user) {
        return null;
      }
      return { user: session.user, groups: session.user.groups ?? [] };
    },

    async SignedIn({ children, groups, fallback }: SignedInProps) {
      // Asserted before the session is read, not inside passesGroups: the
      // signed-out branch short-circuits before that call, so an empty group
      // list would otherwise go unreported for exactly the visitors it is
      // supposed to keep out.
      assertGatedGroups(groups, '<SignedIn groups={...}>');
      const session = await readSession();
      if (!session || !passesGroups(session, groups)) {
        return fallback ?? null;
      }
      return children;
    },

    async SignedOut({ children }: SignedOutProps) {
      const session = await readSession();
      return session ? null : children;
    },
  };
}
