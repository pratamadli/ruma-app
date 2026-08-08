import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { BudgetService } from './budget.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [FamiliesModule],
  controllers: [FinanceController],
  providers: [FinanceService, BudgetService],
  exports: [FinanceService, BudgetService],
})
export class FinanceModule {}
