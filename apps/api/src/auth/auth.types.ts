import type { MembershipRole, MembershipStatus } from '@ruma/types';

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type FamilyMembershipContext = {
  id: string;
  familyId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
};
