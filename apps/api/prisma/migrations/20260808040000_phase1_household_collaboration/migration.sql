-- Phase 1 MVP: tasks, grocery, calendar events, in-app notifications

CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "TaskRecurrence" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'YEARLY');

CREATE TABLE "tasks" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigned_to_id" CHAR(26),
    "created_by_id" CHAR(26) NOT NULL,
    "due_date" DATE,
    "recurrence" "TaskRecurrence" NOT NULL DEFAULT 'NONE',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grocery_lists" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Groceries',
    "created_by_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grocery_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grocery_items" (
    "id" CHAR(26) NOT NULL,
    "list_id" CHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "category" TEXT,
    "assigned_to_id" CHAR(26),
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grocery_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "family_events" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "family_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" CHAR(26) NOT NULL,
    "family_id" CHAR(26) NOT NULL,
    "recipient_id" CHAR(26) NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grocery_lists_family_id_key" ON "grocery_lists"("family_id");
CREATE INDEX "tasks_family_id_status_due_date_idx" ON "tasks"("family_id", "status", "due_date");
CREATE INDEX "tasks_family_id_assigned_to_id_idx" ON "tasks"("family_id", "assigned_to_id");
CREATE INDEX "grocery_items_list_id_is_completed_created_at_idx" ON "grocery_items"("list_id", "is_completed", "created_at");
CREATE INDEX "family_events_family_id_start_at_idx" ON "family_events"("family_id", "start_at");
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at" DESC);
CREATE INDEX "notifications_recipient_id_read_at_idx" ON "notifications"("recipient_id", "read_at");
CREATE INDEX "notifications_family_id_created_at_idx" ON "notifications"("family_id", "created_at" DESC);

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "grocery_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "family_events" ADD CONSTRAINT "family_events_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_events" ADD CONSTRAINT "family_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
