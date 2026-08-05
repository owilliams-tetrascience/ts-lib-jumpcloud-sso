import { handlers } from '../../../../auth';

/**
 * Mounts every Auth.js endpoint under /api/auth/* — sign-in, sign-out, the
 * OIDC callback (/api/auth/callback/jumpcloud), and session reads.
 */
export const { GET, POST } = handlers;
