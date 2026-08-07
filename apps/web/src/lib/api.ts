import type {
  AuthTokensResponse,
  FamilyActivityListResponse,
  FamilyInvitationResponse,
  FamilyInvitationsResponse,
  FamilyListResponse,
  FamilyMembersResponse,
  FamilyResponse,
  HealthResponse,
  InvitationPreviewResponse,
  UserResponse,
} from '@ruma/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export type ApiClientOptions = {
  accessToken?: string | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiClientOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    throw new ApiError(
      body?.error?.message ?? `Request failed (${response.status})`,
      body?.error?.code,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function fetchHealth() {
  return apiFetch<HealthResponse>('/health');
}

export function signUp(input: { email: string; password: string; name?: string }) {
  return apiFetch<AuthTokensResponse>('/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function signIn(input: { email: string; password: string }) {
  return apiFetch<AuthTokensResponse>('/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function refreshSession() {
  return apiFetch<AuthTokensResponse>('/auth/refresh', { method: 'POST' });
}

export function signOut() {
  return apiFetch<{ ok: boolean }>('/auth/sign-out', { method: 'POST' });
}

export function fetchMe(accessToken: string) {
  return apiFetch<UserResponse>('/auth/me', {}, { accessToken });
}

export function listFamilies(accessToken: string) {
  return apiFetch<FamilyListResponse>('/families', {}, { accessToken });
}

export function createFamily(
  accessToken: string,
  input: { name: string; householdName?: string; timezone?: string },
) {
  return apiFetch<FamilyResponse>(
    '/families',
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function getFamily(accessToken: string, familyId: string) {
  return apiFetch<FamilyResponse>(`/families/${familyId}`, {}, { accessToken });
}

export function updateFamily(
  accessToken: string,
  familyId: string,
  input: { name?: string; householdName?: string | null; timezone?: string },
) {
  return apiFetch<FamilyResponse>(
    `/families/${familyId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function listMembers(accessToken: string, familyId: string) {
  return apiFetch<FamilyMembersResponse>(`/families/${familyId}/members`, {}, { accessToken });
}

export function removeMember(accessToken: string, familyId: string, membershipId: string) {
  return apiFetch<{ ok: true }>(
    `/families/${familyId}/members/${membershipId}`,
    { method: 'DELETE' },
    { accessToken },
  );
}

export function createInvitation(
  accessToken: string,
  familyId: string,
  input: { email: string; role?: 'ADMIN' | 'MEMBER' },
) {
  return apiFetch<FamilyInvitationResponse & { inviteUrl: string }>(
    `/families/${familyId}/invitations`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function listInvitations(accessToken: string, familyId: string) {
  return apiFetch<FamilyInvitationsResponse>(
    `/families/${familyId}/invitations`,
    {},
    { accessToken },
  );
}

export function revokeInvitation(accessToken: string, familyId: string, invitationId: string) {
  return apiFetch<{ ok: true }>(
    `/families/${familyId}/invitations/${invitationId}`,
    { method: 'DELETE' },
    { accessToken },
  );
}

export function previewInvitation(token: string) {
  return apiFetch<InvitationPreviewResponse>(`/invitations/${token}`);
}

export function acceptInvitation(accessToken: string, token: string) {
  return apiFetch<FamilyResponse>(
    `/invitations/${token}/accept`,
    { method: 'POST' },
    { accessToken },
  );
}

export function listActivity(accessToken: string, familyId: string) {
  return apiFetch<FamilyActivityListResponse>(
    `/families/${familyId}/activity`,
    {},
    { accessToken },
  );
}
