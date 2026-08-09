import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FamiliesModule } from './families/families.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TasksModule } from './tasks/tasks.module';
import { GroceryModule } from './grocery/grocery.module';
import { CalendarModule } from './calendar/calendar.module';
import { HouseholdModule } from './household/household.module';
import { FinanceModule } from './finance/finance.module';
import { AuthGuard } from './auth/auth.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    EmailModule,
    AuthModule,
    FamiliesModule,
    NotificationsModule,
    TasksModule,
    GroceryModule,
    CalendarModule,
    HouseholdModule,
    FinanceModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
