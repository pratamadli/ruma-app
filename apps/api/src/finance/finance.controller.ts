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
  createBudgetSchema,
  createFinancialAccountSchema,
  createTransactionCategorySchema,
  createTransactionSchema,
  financeAnalysisQuerySchema,
  financeSummaryQuerySchema,
  financeScopeQuerySchema,
  getBudgetQuerySchema,
  listTransactionsQuerySchema,
  updateBudgetSchema,
  updateFinancialAccountSchema,
  updateTransactionCategorySchema,
  updateTransactionSchema,
} from '@ruma/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FamilyMemberGuard } from '../families/family-member.guard';
import { BudgetService } from './budget.service';
import { FinanceService } from './finance.service';
import { IntelligenceService } from './intelligence/intelligence.service';
import type { z } from 'zod';

@Controller('families/:familyId/finance')
@UseGuards(FamilyMemberGuard)
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly budgets: BudgetService,
    private readonly intelligence: IntelligenceService,
  ) {}

  @Get('accounts')
  listAccounts(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(financeScopeQuerySchema))
    query: z.infer<typeof financeScopeQuerySchema>,
  ) {
    return this.finance.listAccounts(familyId, user.id, query.scope);
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('accountId') accountId: string,
    @Body(new ZodValidationPipe(updateFinancialAccountSchema)) body: unknown,
  ) {
    return this.finance.updateAccount(familyId, accountId, body as never, user.id);
  }

  @Get('categories')
  listCategories(@Param('familyId') familyId: string) {
    return this.finance.listCategories(familyId);
  }

  @Post('categories')
  createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Body(new ZodValidationPipe(createTransactionCategorySchema)) body: unknown,
  ) {
    return this.finance.createCategory(familyId, body as never, user.id);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('categoryId') categoryId: string,
    @Body(new ZodValidationPipe(updateTransactionCategorySchema)) body: unknown,
  ) {
    return this.finance.updateCategory(familyId, categoryId, body as never, user.id);
  }

  @Get('transactions')
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Query(new ZodValidationPipe(listTransactionsQuerySchema)) query: unknown,
  ) {
    return this.finance.listTransactions(familyId, query as never, user.id);
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.finance.getTransaction(familyId, transactionId, user.id);
  }

  @Patch('transactions/:transactionId')
  updateTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('transactionId') transactionId: string,
    @Body(new ZodValidationPipe(updateTransactionSchema)) body: unknown,
  ) {
    return this.finance.updateTransaction(familyId, transactionId, body as never, user.id);
  }

  @Delete('transactions/:transactionId')
  @HttpCode(200)
  deleteTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.finance.deleteTransaction(familyId, transactionId, user.id);
  }

  @Get('summary')
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Query(new ZodValidationPipe(financeSummaryQuerySchema)) query: unknown,
  ) {
    return this.finance.getSummary(familyId, query as never, user.id);
  }

  @Get('budgets')
  getBudgetForMonth(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Query(new ZodValidationPipe(getBudgetQuerySchema)) query: unknown,
  ) {
    return this.budgets.getForMonth(familyId, query as never, user.id);
  }

  @Post('budgets')
  createBudget(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBudgetSchema)) body: unknown,
  ) {
    return this.budgets.create(familyId, user.id, body as never);
  }

  @Get('budgets/:budgetId')
  getBudget(
    @Param('familyId') familyId: string,
    @Param('budgetId') budgetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgets.getById(familyId, budgetId, user.id);
  }

  @Patch('budgets/:budgetId')
  updateBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('budgetId') budgetId: string,
    @Body(new ZodValidationPipe(updateBudgetSchema)) body: unknown,
  ) {
    return this.budgets.update(familyId, budgetId, body as never, user.id);
  }

  @Delete('budgets/:budgetId')
  @HttpCode(200)
  archiveBudget(
    @Param('familyId') familyId: string,
    @Param('budgetId') budgetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgets.archive(familyId, budgetId, user.id);
  }

  @Get('analysis')
  getAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Query(new ZodValidationPipe(financeAnalysisQuerySchema)) query: unknown,
  ) {
    return this.intelligence.getAnalysis(familyId, query as never, user.id);
  }
}
