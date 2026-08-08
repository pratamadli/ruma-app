import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [FamiliesModule, NotificationsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
