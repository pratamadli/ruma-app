import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FamilyEventListResponse, FamilyEventResponse } from '@ruma/types';
import type { CreateFamilyEventInput, UpdateFamilyEventInput } from '@ruma/validation';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../families/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createId } from '../common/ids';
import { toMemberRef } from '../common/member-ref';
import { normalizeRecurrence } from '../common/recurrence';

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(familyId: string, from?: string): Promise<FamilyEventListResponse> {
    const start = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await this.prisma.familyEvent.findMany({
      where: { familyId, startAt: { gte: start } },
      include: { createdBy: true },
      orderBy: { startAt: 'asc' },
      take: 100,
    });
    return { events: events.map((event) => this.toResponse(event)) };
  }

  async create(
    familyId: string,
    actorId: string,
    input: CreateFamilyEventInput,
  ): Promise<FamilyEventResponse> {
    this.assertRange(input.startAt, input.endAt ?? null);
    const { recurrence, recurrenceWeekdays } = normalizeRecurrence(input);

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyEvent.create({
        data: {
          id: createId(),
          familyId,
          title: input.title,
          description: input.description,
          location: input.location,
          startAt: new Date(input.startAt),
          endAt: input.endAt ? new Date(input.endAt) : null,
          allDay: input.allDay ?? false,
          recurrence,
          recurrenceWeekdays,
          createdById: actorId,
        },
        include: { createdBy: true },
      });

      await this.activity.record(
        familyId,
        'FAMILY_EVENT_CREATED',
        actorId,
        { eventId: created.id, title: created.title },
        tx,
      );

      const members = await tx.familyMembership.findMany({
        where: { familyId, status: 'ACTIVE', userId: { not: actorId } },
        select: { userId: true },
      });
      await this.notifications.notifyMany(
        familyId,
        members.map((m) => m.userId),
        'EVENT_CREATED',
        'New family event',
        created.title,
        { eventId: created.id, familyId },
        tx,
      );

      return created;
    });

    return this.toResponse(event);
  }

  async update(
    familyId: string,
    eventId: string,
    actorId: string,
    input: UpdateFamilyEventInput,
  ): Promise<FamilyEventResponse> {
    const existing = await this.requireEvent(familyId, eventId);
    const startAt = input.startAt;
    const endAt = input.endAt;
    if (startAt || endAt !== undefined) {
      this.assertRange(
        startAt ?? existing.startAt.toISOString(),
        endAt === undefined ? (existing.endAt?.toISOString() ?? null) : endAt,
      );
    }

    const recurrenceUpdate =
      input.recurrence === undefined && input.recurrenceWeekdays === undefined
        ? undefined
        : normalizeRecurrence({
            recurrence: input.recurrence ?? existing.recurrence,
            recurrenceWeekdays:
              input.recurrenceWeekdays ??
              (input.recurrence === 'CUSTOM_WEEKDAYS' ? existing.recurrenceWeekdays : []),
          });

    const event = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.familyEvent.update({
        where: { id: eventId },
        data: {
          title: input.title,
          description: input.description === undefined ? undefined : input.description,
          location: input.location === undefined ? undefined : input.location,
          startAt: input.startAt ? new Date(input.startAt) : undefined,
          endAt: input.endAt === undefined ? undefined : input.endAt ? new Date(input.endAt) : null,
          allDay: input.allDay,
          recurrence: recurrenceUpdate?.recurrence,
          recurrenceWeekdays: recurrenceUpdate?.recurrenceWeekdays,
        },
        include: { createdBy: true },
      });
      await this.activity.record(
        familyId,
        'FAMILY_EVENT_UPDATED',
        actorId,
        { eventId, title: updated.title },
        tx,
      );
      return updated;
    });

    return this.toResponse(event);
  }

  async remove(familyId: string, eventId: string, actorId: string) {
    const existing = await this.requireEvent(familyId, eventId);
    await this.prisma.$transaction(async (tx) => {
      await tx.familyEvent.delete({ where: { id: eventId } });
      await this.activity.record(
        familyId,
        'FAMILY_EVENT_CANCELLED',
        actorId,
        { eventId, title: existing.title },
        tx,
      );
    });
    return { ok: true };
  }

  private assertRange(startAt: string, endAt: string | null) {
    if (endAt && new Date(endAt) < new Date(startAt)) {
      throw new BadRequestException({
        code: 'INVALID_EVENT_RANGE',
        message: 'endAt must be after startAt.',
      });
    }
  }

  private async requireEvent(familyId: string, eventId: string) {
    const event = await this.prisma.familyEvent.findFirst({
      where: { id: eventId, familyId },
      include: { createdBy: true },
    });
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }
    return event;
  }

  private toResponse(event: {
    id: string;
    familyId: string;
    title: string;
    description: string | null;
    location: string | null;
    startAt: Date;
    endAt: Date | null;
    allDay: boolean;
    recurrence: FamilyEventResponse['recurrence'];
    recurrenceWeekdays: number[];
    createdAt: Date;
    updatedAt: Date;
    createdBy: { id: string; name: string | null; email: string };
  }): FamilyEventResponse {
    return {
      id: event.id,
      familyId: event.familyId,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt?.toISOString() ?? null,
      allDay: event.allDay,
      recurrence: event.recurrence,
      recurrenceWeekdays: event.recurrenceWeekdays,
      createdBy: toMemberRef(event.createdBy)!,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
