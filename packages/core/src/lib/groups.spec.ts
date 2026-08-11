import { describe, expect, it } from 'vitest';
import { assertGatedGroups, hasAnyGroup, normalizeGroups } from './groups.js';

describe('normalizeGroups', () => {
  it('returns [] for undefined (user in zero groups — claim omitted)', () => {
    expect(normalizeGroups(undefined)).toEqual([]);
  });

  it('returns [] for null', () => {
    expect(normalizeGroups(null)).toEqual([]);
  });

  it('returns [] for an empty string', () => {
    expect(normalizeGroups('')).toEqual([]);
  });

  it('wraps a bare string (JumpCloud emits a string when the user is in exactly one group)', () => {
    expect(normalizeGroups('app-admins')).toEqual(['app-admins']);
  });

  it('returns an array as-is (user in two or more groups)', () => {
    const groups = ['app-admins', 'engineering'];
    expect(normalizeGroups(groups)).toBe(groups);
  });

  it('returns an empty array as-is', () => {
    expect(normalizeGroups([])).toEqual([]);
  });

  it('returns [] for non-string, non-array values', () => {
    expect(normalizeGroups(42)).toEqual([]);
    expect(normalizeGroups({ memberOf: 'app-admins' })).toEqual([]);
    expect(normalizeGroups(true)).toEqual([]);
  });
});

describe('hasAnyGroup', () => {
  it('returns true when allowed is empty (no gating configured)', () => {
    expect(hasAnyGroup([], [])).toBe(true);
    expect(hasAnyGroup(['anything'], [])).toBe(true);
  });

  it('returns true when at least one user group is allowed', () => {
    expect(hasAnyGroup(['engineering', 'app-admins'], ['app-admins'])).toBe(
      true,
    );
    expect(hasAnyGroup(['app-admins'], ['app-admins', 'ops'])).toBe(true);
  });

  it('returns false when there is no overlap', () => {
    expect(hasAnyGroup(['engineering'], ['app-admins'])).toBe(false);
  });

  it('returns false when the user has no groups and gating is configured', () => {
    expect(hasAnyGroup([], ['app-admins'])).toBe(false);
  });

  it('matches exact names only (group names are case-sensitive)', () => {
    expect(hasAnyGroup(['App-Admins'], ['app-admins'])).toBe(false);
  });
});

describe('assertGatedGroups', () => {
  // hasAnyGroup's empty-list-means-allow is correct for a pure predicate but
  // fails in the wrong direction for a value that arrived from config. The
  // guards call this first so `requireGroup(process.env.ADMINS?.split(',') ??
  // [])` is a boot failure rather than an open route that still reads gated.
  it('throws on an explicitly empty list', () => {
    expect(() => assertGatedGroups([], 'requireGroup()')).toThrowError(
      /empty group list/,
    );
  });

  it('names the caller so the error points at the misconfiguration', () => {
    expect(() => assertGatedGroups([], 'routeGroups["/admin"]')).toThrowError(
      /routeGroups\["\/admin"\]/,
    );
  });

  it('allows an omitted list — that is the "any signed-in user" spelling', () => {
    expect(() =>
      assertGatedGroups(undefined, 'requireSession()'),
    ).not.toThrow();
  });

  it('allows a populated list', () => {
    expect(() =>
      assertGatedGroups(['app-admins'], 'requireGroup()'),
    ).not.toThrow();
  });
});
