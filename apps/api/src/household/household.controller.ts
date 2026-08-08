import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FamilyMemberGuard } from '../families/family-member.guard';
import { HouseholdService } from './household.service';

@Controller('families/:familyId/dashboard')
@UseGuards(FamilyMemberGuard)
export class HouseholdController {
  constructor(private readonly household: HouseholdService) {}

  @Get()
  dashboard(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.household.dashboard(familyId, user.id);
  }
}
