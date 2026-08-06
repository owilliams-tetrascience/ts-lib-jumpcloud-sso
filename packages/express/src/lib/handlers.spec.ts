import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { createMeHandler, createRequireGroup } from './handlers.js';

interface MockOidc {
  isAuthenticated: () => boolean;
  idTokenClaims?: Record<string, unknown>;
  user?: Record<string, unknown>;
}

function mockReq(oidc?: MockOidc): Request {
  return { oidc } as unknown as Request;
}

function mockRes(): Response & { status: Mock; json: Mock } {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response & { status: Mock; json: Mock };
}

const authenticated = (claims: Record<string, unknown>): MockOidc => ({
  isAuthenticated: () => true,
  idTokenClaims: claims,
  user: { email: 'ada@tetrascience.com', name: 'Ada' },
});

const unauthenticated: MockOidc = { isAuthenticated: () => false };

describe('requireGroup', () => {
  const requireGroup = createRequireGroup('memberOf');

  it('responds 401 when unauthenticated and does not call next', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireGroup(['app-admins'])(mockReq(unauthenticated), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the auth middleware was never mounted (no req.oidc)', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireGroup(['app-admins'])(mockReq(undefined), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when a bare-string claim matches (JumpCloud single-group quirk)', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireGroup(['app-admins'])(
      mockReq(authenticated({ memberOf: 'app-admins' })),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next when an array claim overlaps the allowed list', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireGroup(['app-admins'])(
      mockReq(authenticated({ memberOf: ['engineering', 'app-admins'] })),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('responds 403 with the required groups when there is no overlap', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireGroup(['app-admins'])(
      mockReq(authenticated({ memberOf: ['engineering'] })),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Forbidden',
        requiredGroups: ['app-admins'],
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when the groups claim is missing entirely', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireGroup(['app-admins'])(mockReq(authenticated({})), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('treats an empty allowed list as "any signed-in user"', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireGroup([])(mockReq(authenticated({})), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('honors a custom groups claim name', () => {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    createRequireGroup('groups')(['app-admins'])(
      mockReq(authenticated({ groups: 'app-admins' })),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('meHandler', () => {
  const meHandler = createMeHandler('memberOf');

  it('responds 401 JSON when unauthenticated', () => {
    const res = mockRes();
    meHandler(
      mockReq(unauthenticated),
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized' }),
    );
  });

  it('responds { user, groups } when authenticated, normalizing a bare-string claim', () => {
    const res = mockRes();
    meHandler(
      mockReq(authenticated({ memberOf: 'app-admins' })),
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      user: { email: 'ada@tetrascience.com', name: 'Ada' },
      groups: ['app-admins'],
    });
  });

  it('responds with an array claim as-is', () => {
    const res = mockRes();
    meHandler(
      mockReq(authenticated({ memberOf: ['a', 'b'] })),
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ groups: ['a', 'b'] }),
    );
  });
});
