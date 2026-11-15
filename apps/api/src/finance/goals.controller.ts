import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  createFinanceGoalSchema,
  updateFinanceGoalSchema,
  financeScopeQuerySchema,
  type CreateFinanceGoalInput,
  type UpdateFinanceGoalInput,
} from '@ruma/validation';
import type { z } from 'zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FamilyMemberGuard } from '../families/family-member.guard';
import { GoalsService } from './goals.service';

@Controller('families/:familyId/finance/goals')
@UseGuards(FamilyMemberGuard)
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}
  @Get()
  list(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(financeScopeQuerySchema))
    query: z.infer<typeof financeScopeQuerySchema>,
  ) {
    return this.goals.list(familyId, user.id, query.scope);
  }
  @Post()
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFinanceGoalSchema)) input: CreateFinanceGoalInput,
  ) {
    return this.goals.create(familyId, user.id, input);
  }
  @Patch(':id')
  update(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateFinanceGoalSchema)) input: UpdateFinanceGoalInput,
  ) {
    return this.goals.update(familyId, user.id, id, input);
  }
}
