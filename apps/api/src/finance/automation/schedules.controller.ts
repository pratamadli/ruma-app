import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  financeScheduleSchema,
  financeScopeQuerySchema,
  updateFinanceScheduleSchema,
  type FinanceScheduleInput,
  type UpdateFinanceScheduleInput,
} from '@ruma/validation';
import type { z } from 'zod';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FamilyMemberGuard } from '../../families/family-member.guard';
import { SchedulesService } from './schedules.service';

@Controller('families/:familyId/finance/schedules')
@UseGuards(FamilyMemberGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}
  @Get()
  list(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(financeScopeQuerySchema))
    query: z.infer<typeof financeScopeQuerySchema>,
  ) {
    return this.schedules.list(familyId, user.id, query.scope);
  }
  @Post()
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(financeScheduleSchema)) input: FinanceScheduleInput,
  ) {
    return this.schedules.create(familyId, user.id, input);
  }
  @Patch(':id')
  update(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateFinanceScheduleSchema)) input: UpdateFinanceScheduleInput,
  ) {
    return this.schedules.update(familyId, user.id, id, input);
  }
}
