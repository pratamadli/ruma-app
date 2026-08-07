export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'REMOVED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export type FamilyActivityType =
  | 'FAMILY_CREATED'
  | 'MEMBER_JOINED'
  | 'MEMBER_INVITED'
  | 'MEMBER_REMOVED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REVOKED'
  | 'FAMILY_UPDATED';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown[];
    requestId?: string;
  };
};

export type HealthResponse = {
  status: 'ok';
  service: 'ruma-api';
  timestamp: string;
};

export type ReadyResponse = {
  status: 'ready' | 'not_ready';
  service: 'ruma-api';
  database: 'up' | 'down';
  timestamp: string;
};

export type UserResponse = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

export type AuthTokensResponse = {
  accessToken: string;
  user: UserResponse;
};

export type FamilyResponse = {
  id: string;
  name: string;
  householdName: string | null;
  timezone: string;
  role: MembershipRole;
  createdAt: string;
};

export type FamilyListResponse = {
  families: FamilyResponse[];
};

export type FamilyMemberResponse = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  joinedAt: string;
};

export type FamilyMembersResponse = {
  members: FamilyMemberResponse[];
};

export type FamilyInvitationResponse = {
  id: string;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
};

export type FamilyInvitationsResponse = {
  invitations: FamilyInvitationResponse[];
};

export type InvitationPreviewResponse = {
  familyName: string;
  householdName: string | null;
  inviterName: string | null;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: string;
};

export type FamilyActivityResponse = {
  id: string;
  type: FamilyActivityType | string;
  actor: { id: string; name: string | null; email: string } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type FamilyActivityListResponse = {
  activities: FamilyActivityResponse[];
};
