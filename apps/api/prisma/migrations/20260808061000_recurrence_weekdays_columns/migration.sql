ALTER TABLE "tasks"
ADD COLUMN "recurrence_weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "family_events"
ADD COLUMN "recurrence" "TaskRecurrence" NOT NULL DEFAULT 'NONE',
ADD COLUMN "recurrence_weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
