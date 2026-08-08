import { Injectable, NotFoundException } from '@nestjs/common';
import type { GroceryItemResponse, GroceryListResponse } from '@ruma/types';
import type { CreateGroceryItemInput, UpdateGroceryItemInput } from '@ruma/validation';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../families/activity.service';
import { createId } from '../common/ids';
import { toMemberRef } from '../common/member-ref';

@Injectable()
export class GroceryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async getList(familyId: string, actorId: string): Promise<GroceryListResponse> {
    const list = await this.ensureList(familyId, actorId);
    const items = await this.prisma.groceryItem.findMany({
      where: { listId: list.id },
      include: { assignedTo: true },
      orderBy: [{ isCompleted: 'asc' }, { createdAt: 'desc' }],
    });
    return this.toListResponse(list, items);
  }

  async addItem(
    familyId: string,
    actorId: string,
    input: CreateGroceryItemInput,
  ): Promise<GroceryItemResponse> {
    const list = await this.ensureList(familyId, actorId);
    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.groceryItem.create({
        data: {
          id: createId(),
          listId: list.id,
          name: input.name,
          quantity: input.quantity,
          category: input.category,
          assignedToId: input.assignedToId ?? null,
        },
        include: { assignedTo: true },
      });
      await this.activity.record(
        familyId,
        'GROCERY_ITEM_ADDED',
        actorId,
        { itemId: created.id, name: created.name },
        tx,
      );
      return created;
    });
    return this.toItemResponse(item);
  }

  async updateItem(
    familyId: string,
    itemId: string,
    actorId: string,
    input: UpdateGroceryItemInput,
  ): Promise<GroceryItemResponse> {
    const list = await this.ensureList(familyId, actorId);
    const existing = await this.prisma.groceryItem.findFirst({
      where: { id: itemId, listId: list.id },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'GROCERY_ITEM_NOT_FOUND', message: 'Item not found.' });
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.groceryItem.update({
        where: { id: itemId },
        data: {
          name: input.name,
          quantity: input.quantity === undefined ? undefined : input.quantity,
          category: input.category === undefined ? undefined : input.category,
          assignedToId: input.assignedToId === undefined ? undefined : input.assignedToId,
          isCompleted: input.isCompleted,
          completedAt:
            input.isCompleted === undefined ? undefined : input.isCompleted ? new Date() : null,
        },
        include: { assignedTo: true },
      });

      if (!existing.isCompleted && input.isCompleted === true) {
        await this.activity.record(
          familyId,
          'GROCERY_ITEM_COMPLETED',
          actorId,
          { itemId, name: updated.name },
          tx,
        );
      }
      return updated;
    });

    return this.toItemResponse(item);
  }

  async removeItem(familyId: string, itemId: string, actorId: string) {
    const list = await this.ensureList(familyId, actorId);
    const existing = await this.prisma.groceryItem.findFirst({
      where: { id: itemId, listId: list.id },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'GROCERY_ITEM_NOT_FOUND', message: 'Item not found.' });
    }
    await this.prisma.groceryItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  async clearCompleted(familyId: string, actorId: string) {
    const list = await this.ensureList(familyId, actorId);
    await this.prisma.groceryItem.deleteMany({
      where: { listId: list.id, isCompleted: true },
    });
    return { ok: true };
  }

  private async ensureList(familyId: string, actorId: string) {
    const existing = await this.prisma.groceryList.findUnique({ where: { familyId } });
    if (existing) return existing;
    return this.prisma.groceryList.create({
      data: {
        id: createId(),
        familyId,
        name: 'Groceries',
        createdById: actorId,
      },
    });
  }

  private toListResponse(
    list: { id: string; familyId: string; name: string; createdAt: Date; updatedAt: Date },
    items: Array<Parameters<GroceryService['toItemResponse']>[0]>,
  ): GroceryListResponse {
    return {
      id: list.id,
      familyId: list.familyId,
      name: list.name,
      items: items.map((item) => this.toItemResponse(item)),
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    };
  }

  private toItemResponse(item: {
    id: string;
    listId: string;
    name: string;
    quantity: string | null;
    category: string | null;
    isCompleted: boolean;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    assignedTo: { id: string; name: string | null; email: string } | null;
  }): GroceryItemResponse {
    return {
      id: item.id,
      listId: item.listId,
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      assignedTo: toMemberRef(item.assignedTo),
      isCompleted: item.isCompleted,
      completedAt: item.completedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
