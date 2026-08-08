import { Injectable } from '@nestjs/common';
import type { HouseholdDashboardResponse } from '@ruma/types';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { CalendarService } from '../calendar/calendar.service';
import { GroceryService } from '../grocery/grocery.service';

@Injectable()
export class HouseholdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly calendar: CalendarService,
    private readonly grocery: GroceryService,
  ) {}

  async dashboard(familyId: string, actorId: string): Promise<HouseholdDashboardResponse> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

    const [taskList, grocery, events, todayTasksRemaining] = await Promise.all([
      this.tasks.list(familyId),
      this.grocery.getList(familyId, actorId),
      this.calendar.list(familyId, startOfToday.toISOString()),
      this.prisma.task.count({
        where: {
          familyId,
          status: { not: 'COMPLETED' },
          OR: [{ dueDate: null }, { dueDate: { lt: endOfToday } }],
        },
      }),
    ]);

    const todayTasks = taskList.tasks
      .filter((task) => task.status !== 'COMPLETED')
      .filter((task) => {
        if (!task.dueDate) return true;
        const due = new Date(`${task.dueDate}T00:00:00.000Z`);
        return due < endOfToday;
      })
      .slice(0, 5);

    return {
      todayTasksRemaining,
      groceryOpenCount: grocery.items.filter((item) => !item.isCompleted).length,
      upcomingEventsCount: events.events.length,
      todayTasks,
      upcomingEvents: events.events.slice(0, 5),
    };
  }
}
