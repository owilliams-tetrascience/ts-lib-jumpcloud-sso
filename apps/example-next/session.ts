import { createSessionTools } from '@tetrascience-npm/jumpcloud-sso/next';
import { auth } from './auth';

/**
 * Session-check conveniences bound to this app's `auth`:
 * - `requireSession()` for pages/layouts/server actions (redirects to
 *   sign-in, optionally enforces JumpCloud groups);
 * - `getSessionUser()` when you want to branch instead of bounce;
 * - `<SignedIn>` / `<SignedOut>` for conditional server-rendered UI.
 */
export const { requireSession, getSessionUser, SignedIn, SignedOut } =
  createSessionTools(auth);
