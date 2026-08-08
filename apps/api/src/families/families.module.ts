import { Module, forwardRef } from '@nestjs/common';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { FamilyMemberGuard } from './family-member.guard';
import { RolesGuard } from './roles.guard';
import { ActivityService } from './activity.service';
import { InvitationsService } from './invitations.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [FamiliesController],
  providers: [FamiliesService, InvitationsService, ActivityService, FamilyMemberGuard, RolesGuard],
  exports: [FamiliesService, InvitationsService, ActivityService, FamilyMemberGuard, RolesGuard],
})
export class FamiliesModule {}
