import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TaskListResponse, TaskResponse } from '@ruma/types';
import type { CreateTaskInput, UpdateTaskInput } from '@ruma/validation';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../families/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createId } from '../common/ids';
import { toMemberRef } from '../common/member-ref';
import { normalizeRecurrence } from '../common/recurrence';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(familyId: string): Promise<TaskListResponse> {
    const tasks = await this.prisma.task.findMany({
      where: { familyId },
      include: { assignedTo: true, createdBy: true },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return { tasks: tasks.map((task) => this.toResponse(task)) };
  }

  async get(familyId: string, taskId: string): Promise<TaskResponse> {
    return this.toResponse(await this.requireTask(familyId, taskId));
  }

  async create(familyId: string, actorId: string, input: CreateTaskInput): Promise<TaskResponse> {
    if (input.assignedToId) {
      await this.assertActiveMember(familyId, input.assignedToId);
    }
    const { recurrence, recurrenceWeekdays } = normalizeRecurrence(input);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          id: createId(),
          familyId,
          title: input.title,
          description: input.description,
          status: input.status ?? 'TODO',
          priority: input.priority ?? 'MEDIUM',
          assignedToId: input.assignedToId ?? null,
          createdById: actorId,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          recurrence,
          recurrenceWeekdays,
          completedAt: input.status === 'COMPLETED' ? new Date() : null,
        },
        include: { assignedTo: true, createdBy: true },
      });

      await this.activity.record(
        familyId,
        'TASK_CREATED',
        actorId,
        { taskId: created.id, title: created.title },
        tx,
      );

      if (created.assignedToId && created.assignedToId !== actorId) {
        await this.activity.record(
          familyId,
          'TASK_ASSIGNED',
          actorId,
          { taskId: created.id, title: created.title, assignedToId: created.assignedToId },
          tx,
        );
        await this.notifications.notify(
          {
            familyId,
            recipientId: created.assignedToId,
            type: 'TASK_ASSIGNED',
            title: 'Task assigned to you',
            message: created.title,
            metadata: { taskId: created.id, familyId },
          },
          tx,
        );
      }

      return created;
    });

    return this.toResponse(task);
  }

  async update(
    familyId: string,
    taskId: string,
    actorId: string,
    input: UpdateTaskInput,
  ): Promise<TaskResponse> {
    const existing = await this.requireTask(familyId, taskId);
    if (input.assignedToId) {
      await this.assertActiveMember(familyId, input.assignedToId);
    }

    const nextStatus = input.status ?? existing.status;
    const completedAt = nextStatus === 'COMPLETED' ? (existing.completedAt ?? new Date()) : null;
    const recurrenceUpdate =
      input.recurrence === undefined && input.recurrenceWeekdays === undefined
        ? undefined
        : normalizeRecurrence({
            recurrence: input.recurrence ?? existing.recurrence,
            recurrenceWeekdays:
              input.recurrenceWeekdays ??
              (input.recurrence === 'CUSTOM_WEEKDAYS' ? existing.recurrenceWeekdays : []),
          });

    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          title: input.title,
          description: input.description === undefined ? undefined : input.description,
          status: input.status,
          priority: input.priority,
          assignedToId: input.assignedToId === undefined ? undefined : input.assignedToId,
          dueDate:
            input.dueDate === undefined
              ? undefined
              : input.dueDate
                ? new Date(input.dueDate)
                : null,
          recurrence: recurrenceUpdate?.recurrence,
          recurrenceWeekdays: recurrenceUpdate?.recurrenceWeekdays,
          completedAt,
        },
        include: { assignedTo: true, createdBy: true },
      });

      if (
        input.assignedToId &&
        input.assignedToId !== existing.assignedToId &&
        input.assignedToId !== actorId
      ) {
        await this.activity.record(
          familyId,
          'TASK_ASSIGNED',
          actorId,
          { taskId, title: updated.title, assignedToId: input.assignedToId },
          tx,
        );
        await this.notifications.notify(
          {
            familyId,
            recipientId: input.assignedToId,
            type: 'TASK_ASSIGNED',
            title: 'Task assigned to you',
            message: updated.title,
            metadata: { taskId, familyId },
          },
          tx,
        );
      }

      if (existing.status !== 'COMPLETED' && nextStatus === 'COMPLETED') {
        await this.activity.record(
          familyId,
          'TASK_COMPLETED',
          actorId,
          { taskId, title: updated.title },
          tx,
        );
        const recipients = [existing.createdById, existing.assignedToId].filter(
          (id): id is string => Boolean(id) && id !== actorId,
        );
        await this.notifications.notifyMany(
          familyId,
          recipients,
          'TASK_COMPLETED',
          'Task completed',
          updated.title,
          { taskId, familyId },
          tx,
        );
      }

      return updated;
    });

    return this.toResponse(task);
  }

  async remove(familyId: string, taskId: string) {
    await this.requireTask(familyId, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
    return { ok: true };
  }

  private async requireTask(familyId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, familyId },
      include: { assignedTo: true, createdBy: true },
    });
    if (!task) {
      throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found.' });
    }
    return task;
  }

  private async assertActiveMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findFirst({
      where: { familyId, userId, status: 'ACTIVE', family: { deletedAt: null } },
    });
    if (!membership) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNEE',
        message: 'Assignee must be an active family member.',
      });
    }
  }

  private toResponse(task: {
    id: string;
    familyId: string;
    title: string;
    description: string | null;
    status: TaskResponse['status'];
    priority: TaskResponse['priority'];
    dueDate: Date | null;
    recurrence: TaskResponse['recurrence'];
    recurrenceWeekdays: number[];
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    assignedTo: { id: string; name: string | null; email: string } | null;
    createdBy: { id: string; name: string | null; email: string };
  }): TaskResponse {
    return {
      id: task.id,
      familyId: task.familyId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedTo: toMemberRef(task.assignedTo),
      createdBy: toMemberRef(task.createdBy)!,
      dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
      recurrence: task.recurrence,
      recurrenceWeekdays: task.recurrenceWeekdays,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
