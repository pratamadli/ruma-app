import type {
  AuthTokensResponse,
  FamilyActivityListResponse,
  FamilyEventListResponse,
  FamilyEventResponse,
  FamilyInvitationResponse,
  FamilyInvitationsResponse,
  FamilyListResponse,
  FamilyMembersResponse,
  FamilyResponse,
  FinancialAccountListResponse,
  FinancialAccountResponse,
  FinanceSummaryResponse,
  GroceryItemResponse,
  GroceryListResponse,
  HealthResponse,
  HouseholdDashboardResponse,
  InvitationPreviewResponse,
  NotificationListResponse,
  TaskListResponse,
  TaskResponse,
  TransactionCategoryListResponse,
  TransactionCategoryResponse,
  TransactionListResponse,
  TransactionResponse,
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

export function forgotPassword(input: { email: string }) {
  return apiFetch<{ ok: true }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function resetPassword(input: { token: string; password: string }) {
  return apiFetch<{ ok: true }>('/auth/reset-password', {
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

export function getHouseholdDashboard(accessToken: string, familyId: string) {
  return apiFetch<HouseholdDashboardResponse>(
    `/families/${familyId}/dashboard`,
    {},
    { accessToken },
  );
}

export function listTasks(accessToken: string, familyId: string) {
  return apiFetch<TaskListResponse>(`/families/${familyId}/tasks`, {}, { accessToken });
}

export function createTask(
  accessToken: string,
  familyId: string,
  input: {
    title: string;
    description?: string;
    status?: TaskResponse['status'];
    priority?: TaskResponse['priority'];
    assignedToId?: string | null;
    dueDate?: string | null;
    recurrence?: TaskResponse['recurrence'];
    recurrenceWeekdays?: number[];
  },
) {
  return apiFetch<TaskResponse>(
    `/families/${familyId}/tasks`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function updateTask(
  accessToken: string,
  familyId: string,
  taskId: string,
  input: Partial<{
    title: string;
    description: string | null;
    status: TaskResponse['status'];
    priority: TaskResponse['priority'];
    assignedToId: string | null;
    dueDate: string | null;
    recurrence: TaskResponse['recurrence'];
    recurrenceWeekdays: number[];
  }>,
) {
  return apiFetch<TaskResponse>(
    `/families/${familyId}/tasks/${taskId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function deleteTask(accessToken: string, familyId: string, taskId: string) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/tasks/${taskId}`,
    { method: 'DELETE' },
    { accessToken },
  );
}

export function getGrocery(accessToken: string, familyId: string) {
  return apiFetch<GroceryListResponse>(`/families/${familyId}/grocery`, {}, { accessToken });
}

export function addGroceryItem(
  accessToken: string,
  familyId: string,
  input: { name: string; quantity?: string; category?: string },
) {
  return apiFetch<GroceryItemResponse>(
    `/families/${familyId}/grocery/items`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function updateGroceryItem(
  accessToken: string,
  familyId: string,
  itemId: string,
  input: Partial<{
    name: string;
    quantity: string | null;
    category: string | null;
    isCompleted: boolean;
  }>,
) {
  return apiFetch<GroceryItemResponse>(
    `/families/${familyId}/grocery/items/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function deleteGroceryItem(accessToken: string, familyId: string, itemId: string) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/grocery/items/${itemId}`,
    { method: 'DELETE' },
    { accessToken },
  );
}

export function clearCompletedGrocery(accessToken: string, familyId: string) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/grocery/clear-completed`,
    { method: 'POST' },
    { accessToken },
  );
}

export function listEvents(accessToken: string, familyId: string, from?: string) {
  const query = from ? `?from=${encodeURIComponent(from)}` : '';
  return apiFetch<FamilyEventListResponse>(
    `/families/${familyId}/events${query}`,
    {},
    { accessToken },
  );
}

export function createEvent(
  accessToken: string,
  familyId: string,
  input: {
    title: string;
    description?: string;
    location?: string;
    startAt: string;
    endAt?: string | null;
    allDay?: boolean;
    recurrence?: FamilyEventResponse['recurrence'];
    recurrenceWeekdays?: number[];
  },
) {
  return apiFetch<FamilyEventResponse>(
    `/families/${familyId}/events`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function updateEvent(
  accessToken: string,
  familyId: string,
  eventId: string,
  input: Partial<{
    title: string;
    description: string | null;
    location: string | null;
    startAt: string;
    endAt: string | null;
    allDay: boolean;
  }>,
) {
  return apiFetch<FamilyEventResponse>(
    `/families/${familyId}/events/${eventId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function deleteEvent(accessToken: string, familyId: string, eventId: string) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/events/${eventId}`,
    { method: 'DELETE' },
    { accessToken },
  );
}

export function listNotifications(accessToken: string) {
  return apiFetch<NotificationListResponse>('/notifications', {}, { accessToken });
}

export function markNotificationRead(accessToken: string, notificationId: string) {
  return apiFetch<{ ok: boolean }>(
    `/notifications/${notificationId}/read`,
    { method: 'PATCH' },
    { accessToken },
  );
}

export function markAllNotificationsRead(accessToken: string) {
  return apiFetch<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }, { accessToken });
}

export function getFinanceSummary(accessToken: string, familyId: string, month?: string) {
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  const qs = params.toString();
  return apiFetch<FinanceSummaryResponse>(
    `/families/${familyId}/finance/summary${qs ? `?${qs}` : ''}`,
    {},
    { accessToken },
  );
}

export function listFinanceAccounts(accessToken: string, familyId: string) {
  return apiFetch<FinancialAccountListResponse>(
    `/families/${familyId}/finance/accounts`,
    {},
    { accessToken },
  );
}

export function createFinanceAccount(
  accessToken: string,
  familyId: string,
  input: {
    name: string;
    type?: 'BANK' | 'CASH' | 'E_WALLET' | 'CREDIT_CARD' | 'OTHER';
    initialBalanceMinor?: string;
    ownerUserId?: string | null;
  },
) {
  return apiFetch<FinancialAccountResponse>(
    `/families/${familyId}/finance/accounts`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function updateFinanceAccount(
  accessToken: string,
  familyId: string,
  accountId: string,
  input: {
    name?: string;
    type?: 'BANK' | 'CASH' | 'E_WALLET' | 'CREDIT_CARD' | 'OTHER';
    ownerUserId?: string | null;
    isActive?: boolean;
  },
) {
  return apiFetch<FinancialAccountResponse>(
    `/families/${familyId}/finance/accounts/${accountId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function listFinanceCategories(accessToken: string, familyId: string) {
  return apiFetch<TransactionCategoryListResponse>(
    `/families/${familyId}/finance/categories`,
    {},
    { accessToken },
  );
}

export function createFinanceCategory(
  accessToken: string,
  familyId: string,
  input: { name: string; kind: 'INCOME' | 'EXPENSE' },
) {
  return apiFetch<TransactionCategoryResponse>(
    `/families/${familyId}/finance/categories`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function updateFinanceCategory(
  accessToken: string,
  familyId: string,
  categoryId: string,
  input: { name?: string; isActive?: boolean },
) {
  return apiFetch<TransactionCategoryResponse>(
    `/families/${familyId}/finance/categories/${categoryId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function listFinanceTransactions(
  accessToken: string,
  familyId: string,
  query: {
    from?: string;
    to?: string;
    type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    categoryId?: string;
    accountId?: string;
    q?: string;
  } = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return apiFetch<TransactionListResponse>(
    `/families/${familyId}/finance/transactions${qs ? `?${qs}` : ''}`,
    {},
    { accessToken },
  );
}

export function createFinanceTransaction(
  accessToken: string,
  familyId: string,
  input: {
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    amountMinor: string;
    accountId: string;
    transferAccountId?: string;
    categoryId?: string | null;
    description?: string;
    transactionDate: string;
  },
) {
  return apiFetch<TransactionResponse>(
    `/families/${familyId}/finance/transactions`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function updateFinanceTransaction(
  accessToken: string,
  familyId: string,
  transactionId: string,
  input: {
    type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    amountMinor?: string;
    accountId?: string;
    transferAccountId?: string | null;
    categoryId?: string | null;
    description?: string | null;
    transactionDate?: string;
  },
) {
  return apiFetch<TransactionResponse>(
    `/families/${familyId}/finance/transactions/${transactionId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function deleteFinanceTransaction(
  accessToken: string,
  familyId: string,
  transactionId: string,
) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/finance/transactions/${transactionId}`,
    { method: 'DELETE' },
    { accessToken },
  );
}
