import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { TasksModule } from '../tasks/tasks.module';
import { GroceryModule } from '../grocery/grocery.module';
import { CalendarModule } from '../calendar/calendar.module';
import { HouseholdController } from './household.controller';
import { HouseholdService } from './household.service';

@Module({
  imports: [FamiliesModule, TasksModule, GroceryModule, CalendarModule],
  controllers: [HouseholdController],
  providers: [HouseholdService],
})
export class HouseholdModule {}
