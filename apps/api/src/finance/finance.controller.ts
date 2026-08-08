import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createFinancialAccountSchema,
  createTransactionCategorySchema,
  createTransactionSchema,
  financeSummaryQuerySchema,
  listTransactionsQuerySchema,
  updateFinancialAccountSchema,
  updateTransactionCategorySchema,
  updateTransactionSchema,
} from '@ruma/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FamilyMemberGuard } from '../families/family-member.guard';
import { FinanceService } from './finance.service';

@Controller('families/:familyId/finance')
@UseGuards(FamilyMemberGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('accounts')
  listAccounts(@Param('familyId') familyId: string) {
    return this.finance.listAccounts(familyId);
  }

  @Post('accounts')
  createAccount(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFinancialAccountSchema)) body: unknown,
  ) {
    return this.finance.createAccount(familyId, user.id, body as never);
  }

  @Patch('accounts/:accountId')
  updateAccount(
    @Param('familyId') familyId: string,
    @Param('accountId') accountId: string,
    @Body(new ZodValidationPipe(updateFinancialAccountSchema)) body: unknown,
  ) {
    return this.finance.updateAccount(familyId, accountId, body as never);
  }

  @Get('categories')
  listCategories(@Param('familyId') familyId: string) {
    return this.finance.listCategories(familyId);
  }

  @Post('categories')
  createCategory(
    @Param('familyId') familyId: string,
    @Body(new ZodValidationPipe(createTransactionCategorySchema)) body: unknown,
  ) {
    return this.finance.createCategory(familyId, body as never);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Param('familyId') familyId: string,
    @Param('categoryId') categoryId: string,
    @Body(new ZodValidationPipe(updateTransactionCategorySchema)) body: unknown,
  ) {
    return this.finance.updateCategory(familyId, categoryId, body as never);
  }

  @Get('transactions')
  listTransactions(
    @Param('familyId') familyId: string,
    @Query(new ZodValidationPipe(listTransactionsQuerySchema)) query: unknown,
  ) {
    return this.finance.listTransactions(familyId, query as never);
  }

  @Post('transactions')
  createTransaction(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTransactionSchema)) body: unknown,
  ) {
    return this.finance.createTransaction(familyId, user.id, body as never);
  }

  @Get('transactions/:transactionId')
  getTransaction(
    @Param('familyId') familyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.finance.getTransaction(familyId, transactionId);
  }

  @Patch('transactions/:transactionId')
  updateTransaction(
    @Param('familyId') familyId: string,
    @Param('transactionId') transactionId: string,
    @Body(new ZodValidationPipe(updateTransactionSchema)) body: unknown,
  ) {
    return this.finance.updateTransaction(familyId, transactionId, body as never);
  }

  @Delete('transactions/:transactionId')
  @HttpCode(200)
  deleteTransaction(
    @Param('familyId') familyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.finance.deleteTransaction(familyId, transactionId);
  }

  @Get('summary')
  getSummary(
    @Param('familyId') familyId: string,
    @Query(new ZodValidationPipe(financeSummaryQuerySchema)) query: unknown,
  ) {
    return this.finance.getSummary(familyId, query as never);
  }
}
