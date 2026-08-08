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
  financeSummaryQuerySchema,
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

@Controller('families/:familyId/finance')
@UseGuards(FamilyMemberGuard)
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly budgets: BudgetService,
  ) {}

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

  @Get('budgets')
  getBudgetForMonth(
    @Param('familyId') familyId: string,
    @Query(new ZodValidationPipe(getBudgetQuerySchema)) query: unknown,
  ) {
    return this.budgets.getForMonth(familyId, query as never);
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
  getBudget(@Param('familyId') familyId: string, @Param('budgetId') budgetId: string) {
    return this.budgets.getById(familyId, budgetId);
  }

  @Patch('budgets/:budgetId')
  updateBudget(
    @Param('familyId') familyId: string,
    @Param('budgetId') budgetId: string,
    @Body(new ZodValidationPipe(updateBudgetSchema)) body: unknown,
  ) {
    return this.budgets.update(familyId, budgetId, body as never);
  }

  @Delete('budgets/:budgetId')
  @HttpCode(200)
  archiveBudget(@Param('familyId') familyId: string, @Param('budgetId') budgetId: string) {
    return this.budgets.archive(familyId, budgetId);
  }
}
