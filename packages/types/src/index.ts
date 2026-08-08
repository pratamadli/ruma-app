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
  | 'FAMILY_UPDATED'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'TASK_ASSIGNED'
  | 'GROCERY_ITEM_ADDED'
  | 'GROCERY_ITEM_COMPLETED'
  | 'FAMILY_EVENT_CREATED'
  | 'FAMILY_EVENT_UPDATED'
  | 'FAMILY_EVENT_CANCELLED';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
/** ISO weekday for CUSTOM_WEEKDAYS: 1 = Monday … 7 = Sunday */
export type RecurrenceWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TaskRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM_WEEKDAYS';

export type NotificationType =
  'TASK_ASSIGNED' | 'TASK_COMPLETED' | 'EVENT_CREATED' | 'MEMBER_JOINED';

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

export type TaskMemberRef = {
  id: string;
  name: string | null;
  email: string;
};

export type TaskResponse = {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: TaskMemberRef | null;
  createdBy: TaskMemberRef;
  dueDate: string | null;
  recurrence: TaskRecurrence;
  recurrenceWeekdays: number[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListResponse = {
  tasks: TaskResponse[];
};

export type GroceryItemResponse = {
  id: string;
  listId: string;
  name: string;
  quantity: string | null;
  category: string | null;
  assignedTo: TaskMemberRef | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroceryListResponse = {
  id: string;
  familyId: string;
  name: string;
  items: GroceryItemResponse[];
  createdAt: string;
  updatedAt: string;
};

export type FamilyEventResponse = {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  recurrence: TaskRecurrence;
  recurrenceWeekdays: number[];
  createdBy: TaskMemberRef;
  createdAt: string;
  updatedAt: string;
};

export type FamilyEventListResponse = {
  events: FamilyEventResponse[];
};

export type NotificationResponse = {
  id: string;
  familyId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  notifications: NotificationResponse[];
  unreadCount: number;
};

export type HouseholdDashboardResponse = {
  todayTasksRemaining: number;
  groceryOpenCount: number;
  upcomingEventsCount: number;
  todayTasks: TaskResponse[];
  upcomingEvents: FamilyEventResponse[];
};

/** Minor-unit money as decimal string — never a JS number. */
export type MoneyMinorString = string;

export type FinancialAccountType = 'BANK' | 'CASH' | 'E_WALLET' | 'CREDIT_CARD' | 'OTHER';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type CategoryKind = 'INCOME' | 'EXPENSE';
export type TransactionSource = 'MANUAL' | 'IMPORT';

export type FinancialAccountResponse = {
  id: string;
  familyId: string;
  name: string;
  type: FinancialAccountType;
  currency: string;
  initialBalanceMinor: MoneyMinorString;
  /** Authoritative balance computed server-side. */
  balanceMinor: MoneyMinorString;
  ownerUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FinancialAccountListResponse = {
  accounts: FinancialAccountResponse[];
  currency: string;
};

export type TransactionCategoryResponse = {
  id: string;
  familyId: string;
  name: string;
  kind: CategoryKind;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TransactionCategoryListResponse = {
  categories: TransactionCategoryResponse[];
};

export type TransactionAccountRef = {
  id: string;
  name: string;
  type: FinancialAccountType;
};

export type TransactionCategoryRef = {
  id: string;
  name: string;
  kind: CategoryKind;
};

export type TransactionResponse = {
  id: string;
  familyId: string;
  type: TransactionType;
  amountMinor: MoneyMinorString;
  currency: string;
  account: TransactionAccountRef;
  transferAccount: TransactionAccountRef | null;
  category: TransactionCategoryRef | null;
  description: string | null;
  transactionDate: string;
  source: TransactionSource;
  createdBy: TaskMemberRef;
  createdAt: string;
  updatedAt: string;
};

export type TransactionListResponse = {
  transactions: TransactionResponse[];
};

export type FinanceCategoryTotal = {
  categoryId: string;
  name: string;
  amountMinor: MoneyMinorString;
};

export type FinanceSummaryResponse = {
  month: string;
  currency: string;
  incomeMinor: MoneyMinorString;
  expenseMinor: MoneyMinorString;
  netCashFlowMinor: MoneyMinorString;
  transferMinor: MoneyMinorString;
  expensesByCategory: FinanceCategoryTotal[];
  recentTransactions: TransactionResponse[];
  accounts: FinancialAccountResponse[];
};
