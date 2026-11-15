import type {
  TelegramLinkStatusResponse,
  TelegramLinkCodeResponse,
  FinanceScheduleRequest,
  FinanceScheduleResponse,
  InvestmentPositionResponse,
  FinanceReceiptResponse,
  FinanceDraftResponse,
  FinanceDraftPayload,
  FinanceGoalResponse,
  FinanceScope,
  FinancialAccountType,
  TransactionType,
  CategoryKind,
  AuthTokensResponse,
  BudgetMonthResponse,
  BudgetProgressResponse,
  ConfirmImportResponse,
  EmailConnectionListResponse,
  EmailConnectionResponse,
  FinanceAnalysisResponse,
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
  ImportCandidateListResponse,
  ImportCandidateResponse,
  ImportSyncResultResponse,
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
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
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

export function listInvestments(accessToken: string, familyId: string, scope: FinanceScope) {
  return apiFetch<{ positions: InvestmentPositionResponse[]; totalValuationMinor: string }>(
    `/families/${familyId}/finance/investments?scope=${scope}`,
    {},
    { accessToken },
  );
}
export function createInvestmentPosition(
  accessToken: string,
  familyId: string,
  input: {
    scope: FinanceScope;
    accountId: string;
    instrumentName: string;
    assetType: string;
    unitsDecimal: string;
  },
) {
  return apiFetch<{ id: string }>(
    `/families/${familyId}/finance/investments`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}
export function updateInvestmentPosition(
  accessToken: string,
  familyId: string,
  id: string,
  input: {
    instrumentName?: string;
    unitsDecimal?: string;
    isActive?: boolean;
  },
) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/finance/investments/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}
export function valueInvestment(
  accessToken: string,
  familyId: string,
  id: string,
  input: { valuationDate: string; valueMinor: string },
) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/finance/investments/${id}/valuations`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}
export function listFinanceSchedules(accessToken: string, familyId: string, scope: FinanceScope) {
  return apiFetch<{ schedules: FinanceScheduleResponse[] }>(
    `/families/${familyId}/finance/schedules?scope=${scope}`,
    {},
    { accessToken },
  );
}
export function createFinanceSchedule(
  accessToken: string,
  familyId: string,
  input: FinanceScheduleRequest,
) {
  return apiFetch<{ id: string }>(
    `/families/${familyId}/finance/schedules`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}
export function updateFinanceSchedule(
  accessToken: string,
  familyId: string,
  id: string,
  input: Partial<Omit<FinanceScheduleRequest, 'scope' | 'kind'>> & { enabled?: boolean },
) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/finance/schedules/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
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

export function getFinanceSummary(
  accessToken: string,
  familyId: string,
  month?: string,
  scope: FinanceScope = 'HOUSEHOLD',
) {
  const params = new URLSearchParams();
  params.set('scope', scope);
  if (month) params.set('month', month);
  const qs = params.toString();
  return apiFetch<FinanceSummaryResponse>(
    `/families/${familyId}/finance/summary${qs ? `?${qs}` : ''}`,
    {},
    { accessToken },
  );
}

export function listFinanceAccounts(
  accessToken: string,
  familyId: string,
  scope: FinanceScope = 'HOUSEHOLD',
) {
  return apiFetch<FinancialAccountListResponse>(
    `/families/${familyId}/finance/accounts?scope=${scope}`,
    {},
    { accessToken },
  );
}

export function createFinanceAccount(
  accessToken: string,
  familyId: string,
  input: {
    scope?: FinanceScope;
    name: string;
    type?: FinancialAccountType;
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
    type?: FinancialAccountType;
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
  input: { name: string; kind: CategoryKind },
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
    scope?: FinanceScope;
    offset?: number;
    limit?: number;
    payerUserId?: string;
    from?: string;
    to?: string;
    type?: TransactionType;
    categoryId?: string;
    accountId?: string;
    q?: string;
  } = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
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
    instrumentName?: string;
    unitsDecimal?: string;
    unitPriceMinor?: string;
    feesMinor?: string;
    scope?: FinanceScope;
    payerUserId?: string;
    adjustmentDirection?: 'INCREASE' | 'DECREASE';
    idempotencyKey?: string;
    type: TransactionType;
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
    instrumentName?: string;
    unitsDecimal?: string;
    unitPriceMinor?: string;
    feesMinor?: string;
    payerUserId?: string;
    adjustmentDirection?: 'INCREASE' | 'DECREASE';
    type?: TransactionType;
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

export function getFinanceBudget(
  accessToken: string,
  familyId: string,
  month?: string,
  scope: FinanceScope = 'HOUSEHOLD',
) {
  const params = new URLSearchParams();
  params.set('scope', scope);
  if (month) params.set('month', month);
  const qs = params.toString();
  return apiFetch<BudgetMonthResponse>(
    `/families/${familyId}/finance/budgets${qs ? `?${qs}` : ''}`,
    {},
    { accessToken },
  );
}

export function createFinanceBudget(
  accessToken: string,
  familyId: string,
  input: {
    scope?: FinanceScope;
    plannedIncomeMinor?: string;
    savingsAllocationMinor?: string;
    investmentAllocationMinor?: string;
    periodMonth: string;
    totalAmountMinor?: string | null;
    items?: Array<{ categoryId: string; amountMinor: string }>;
  },
) {
  return apiFetch<BudgetProgressResponse>(
    `/families/${familyId}/finance/budgets`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function updateFinanceBudget(
  accessToken: string,
  familyId: string,
  budgetId: string,
  input: {
    plannedIncomeMinor?: string;
    savingsAllocationMinor?: string;
    investmentAllocationMinor?: string;
    totalAmountMinor?: string | null;
    items?: Array<{ categoryId: string; amountMinor: string }>;
    status?: 'ACTIVE' | 'ARCHIVED';
  },
) {
  return apiFetch<BudgetProgressResponse>(
    `/families/${familyId}/finance/budgets/${budgetId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function archiveFinanceBudget(accessToken: string, familyId: string, budgetId: string) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/finance/budgets/${budgetId}`,
    { method: 'DELETE' },
    { accessToken },
  );
}

export function listFinanceGoals(accessToken: string, familyId: string, scope: FinanceScope) {
  return apiFetch<{ goals: FinanceGoalResponse[] }>(
    `/families/${familyId}/finance/goals?scope=${scope}`,
    {},
    { accessToken },
  );
}

export function listFinanceDrafts(accessToken: string, familyId: string) {
  return apiFetch<{ drafts: FinanceDraftResponse[] }>(
    `/families/${familyId}/finance/drafts`,
    {},
    { accessToken },
  );
}
export function listFinanceReceipts(accessToken: string, familyId: string) {
  return apiFetch<{ receipts: FinanceReceiptResponse[] }>(
    `/families/${familyId}/finance/receipts`,
    {},
    { accessToken },
  );
}
export function getFinanceTransaction(accessToken: string, familyId: string, id: string) {
  return apiFetch<TransactionResponse & { receiptIds: string[] }>(
    `/families/${familyId}/finance/transactions/${id}`,
    {},
    { accessToken },
  );
}
export function uploadFinanceReceipt(
  accessToken: string,
  familyId: string,
  scope: FinanceScope,
  file: File,
) {
  const body = new FormData();
  body.set('scope', scope);
  body.set('file', file);
  return apiFetch<FinanceReceiptResponse>(
    `/families/${familyId}/finance/receipts`,
    { method: 'POST', body },
    { accessToken },
  );
}
export function createReceiptDraft(
  accessToken: string,
  familyId: string,
  id: string,
  transaction: FinanceDraftPayload,
) {
  return apiFetch<{ draft: FinanceDraftResponse; possibleDuplicateTransactionId: string | null }>(
    `/families/${familyId}/finance/receipts/${id}/draft`,
    { method: 'POST', body: JSON.stringify({ transaction, idempotencyKey: `receipt:${id}` }) },
    { accessToken },
  );
}
export async function downloadFinanceReceipt(accessToken: string, familyId: string, id: string) {
  const response = await fetch(`${API_URL}/families/${familyId}/finance/receipts/${id}/file`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!response.ok) throw new ApiError('Unable to download receipt.', undefined, response.status);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'receipt.jpg';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function confirmFinanceDraft(accessToken: string, familyId: string, id: string) {
  return apiFetch<{ transactionId: string; status: string }>(
    `/families/${familyId}/finance/drafts/${id}/confirm`,
    { method: 'POST' },
    { accessToken },
  );
}
export function cancelFinanceDraft(accessToken: string, familyId: string, id: string) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/finance/drafts/${id}`,
    { method: 'DELETE' },
    { accessToken },
  );
}
export function replaceFinanceDraft(
  accessToken: string,
  familyId: string,
  id: string,
  transaction: FinanceDraftPayload,
) {
  return apiFetch<FinanceDraftResponse>(
    `/families/${familyId}/finance/drafts/${id}`,
    { method: 'PATCH', body: JSON.stringify({ transaction, idempotencyKey: crypto.randomUUID() }) },
    { accessToken },
  );
}
export function getTelegramLink(accessToken: string, familyId: string) {
  return apiFetch<TelegramLinkStatusResponse>(
    `/families/${familyId}/finance/telegram`,
    {},
    { accessToken },
  );
}
export function createTelegramLink(accessToken: string, familyId: string) {
  return apiFetch<TelegramLinkCodeResponse>(
    `/families/${familyId}/finance/telegram/link`,
    { method: 'POST' },
    { accessToken },
  );
}
export function unlinkTelegram(accessToken: string, familyId: string) {
  return apiFetch<{ ok: boolean }>(
    `/families/${familyId}/finance/telegram/link`,
    { method: 'DELETE' },
    { accessToken },
  );
}
export function createFinanceGoal(
  accessToken: string,
  familyId: string,
  input: {
    scope: FinanceScope;
    name: string;
    targetAmountMinor: string;
    currentAmountMinor?: string;
    targetDate?: string | null;
  },
) {
  return apiFetch<FinanceGoalResponse>(
    `/families/${familyId}/finance/goals`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}
export function updateFinanceGoal(
  accessToken: string,
  familyId: string,
  id: string,
  input: {
    name?: string;
    targetAmountMinor?: string;
    currentAmountMinor?: string;
    targetDate?: string | null;
    status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  },
) {
  return apiFetch<FinanceGoalResponse>(
    `/families/${familyId}/finance/goals/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function getFinanceAnalysis(
  accessToken: string,
  familyId: string,
  query: { month?: string; months?: number; scope?: FinanceScope } = {},
) {
  const params = new URLSearchParams();
  if (query.month) params.set('month', query.month);
  if (query.months != null) params.set('months', String(query.months));
  if (query.scope) params.set('scope', query.scope);
  const qs = params.toString();
  return apiFetch<FinanceAnalysisResponse>(
    `/families/${familyId}/finance/analysis${qs ? `?${qs}` : ''}`,
    {},
    { accessToken },
  );
}

export function listEmailConnections(accessToken: string, familyId: string) {
  return apiFetch<EmailConnectionListResponse>(
    `/families/${familyId}/integrations/email`,
    {},
    { accessToken },
  );
}

export function connectSyntheticEmail(accessToken: string, familyId: string) {
  return apiFetch<EmailConnectionResponse>(
    `/families/${familyId}/integrations/email/synthetic`,
    { method: 'POST', body: JSON.stringify({}) },
    { accessToken },
  );
}

export function getGmailAuthUrl(accessToken: string, familyId: string) {
  return apiFetch<{ url: string; state: string }>(
    `/families/${familyId}/integrations/email/gmail/auth-url`,
    {},
    { accessToken },
  );
}

export function completeGmailOAuth(
  accessToken: string,
  familyId: string,
  input: { code: string; state: string },
) {
  return apiFetch<EmailConnectionResponse>(
    `/families/${familyId}/integrations/email/gmail`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function disconnectEmailConnection(
  accessToken: string,
  familyId: string,
  connectionId: string,
) {
  return apiFetch<EmailConnectionResponse>(
    `/families/${familyId}/integrations/email/${connectionId}`,
    { method: 'DELETE' },
    { accessToken },
  );
}

export function syncEmailImports(
  accessToken: string,
  familyId: string,
  connectionId: string,
  lookbackDays: 7 | 30 | 90,
) {
  return apiFetch<ImportSyncResultResponse>(
    `/families/${familyId}/integrations/email/${connectionId}/sync`,
    { method: 'POST', body: JSON.stringify({ lookbackDays }) },
    { accessToken },
  );
}

export function listFinanceImports(
  accessToken: string,
  familyId: string,
  status?: 'PENDING_REVIEW' | 'CONFIRMED' | 'IGNORED' | 'FAILED',
) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const qs = params.toString();
  return apiFetch<ImportCandidateListResponse>(
    `/families/${familyId}/finance/imports${qs ? `?${qs}` : ''}`,
    {},
    { accessToken },
  );
}

export function updateFinanceImport(
  accessToken: string,
  familyId: string,
  candidateId: string,
  input: {
    transactionType?: TransactionType;
    amountMinor?: string;
    currency?: string;
    transactionDate?: string;
    description?: string | null;
    merchant?: string | null;
    accountId?: string | null;
    categoryId?: string | null;
    transferAccountId?: string | null;
    categoryHint?: string | null;
  },
) {
  return apiFetch<ImportCandidateResponse>(
    `/families/${familyId}/finance/imports/${candidateId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function confirmFinanceImport(
  accessToken: string,
  familyId: string,
  candidateId: string,
  input: {
    transactionType?: TransactionType;
    amountMinor?: string;
    currency?: string;
    transactionDate?: string;
    description?: string | null;
    accountId?: string;
    categoryId?: string | null;
    transferAccountId?: string;
  } = {},
) {
  return apiFetch<ConfirmImportResponse>(
    `/families/${familyId}/finance/imports/${candidateId}/confirm`,
    { method: 'POST', body: JSON.stringify(input) },
    { accessToken },
  );
}

export function ignoreFinanceImport(accessToken: string, familyId: string, candidateId: string) {
  return apiFetch<ImportCandidateResponse>(
    `/families/${familyId}/finance/imports/${candidateId}/ignore`,
    { method: 'POST', body: JSON.stringify({}) },
    { accessToken },
  );
}

export function bulkIgnoreFinanceImports(
  accessToken: string,
  familyId: string,
  candidateIds: string[],
) {
  return apiFetch<{ ignored: number; skipped: number }>(
    `/families/${familyId}/finance/imports/bulk-ignore`,
    { method: 'POST', body: JSON.stringify({ candidateIds }) },
    { accessToken },
  );
}
