import { describe, expect, it } from 'vitest';
import type { FamilyResponse, HealthResponse, MembershipRole } from './index';

describe('@ruma/types', () => {
  it('exposes stable membership roles for contracts', () => {
    const roles: MembershipRole[] = ['OWNER', 'ADMIN', 'MEMBER'];
    expect(roles).toHaveLength(3);
  });

  it('describes health payload shape', () => {
    const payload: HealthResponse = {
      status: 'ok',
      service: 'ruma-api',
      timestamp: new Date().toISOString(),
    };
    expect(payload.status).toBe('ok');
  });

  it('describes family workspace payload', () => {
    const family: FamilyResponse = {
      id: '01FAMILYEXAMPLE0000000001',
      name: 'Pratama Household',
      householdName: 'Home',
      timezone: 'Asia/Jakarta',
      role: 'OWNER',
      createdAt: new Date().toISOString(),
    };
    expect(family.timezone).toBe('Asia/Jakarta');
  });
});
