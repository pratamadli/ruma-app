import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  financeScopeQuerySchema,
  investmentPositionSchema,
  investmentValuationSchema,
  updatePositionSchema,
  type InvestmentPositionInput,
  type InvestmentValuationInput,
  type UpdatePositionInput,
} from '@ruma/validation';
import type { z } from 'zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FamilyMemberGuard } from '../families/family-member.guard';
import { InvestmentsService } from './investments.service';

@Controller('families/:familyId/finance/investments')
@UseGuards(FamilyMemberGuard)
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}
  @Get()
  list(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(financeScopeQuerySchema))
    query: z.infer<typeof financeScopeQuerySchema>,
  ) {
    return this.investments.list(familyId, user.id, query.scope);
  }
  @Post()
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(investmentPositionSchema)) input: InvestmentPositionInput,
  ) {
    return this.investments.create(familyId, user.id, input);
  }
  @Patch(':id')
  update(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updatePositionSchema)) input: UpdatePositionInput,
  ) {
    return this.investments.update(familyId, user.id, id, input);
  }
  @Post(':id/valuations')
  value(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(investmentValuationSchema)) input: InvestmentValuationInput,
  ) {
    return this.investments.value(familyId, user.id, id, input);
  }
}
