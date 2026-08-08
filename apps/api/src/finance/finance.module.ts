import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { BudgetService } from './budget.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { IntelligenceService } from './intelligence/intelligence.service';

@Module({
  imports: [FamiliesModule],
  controllers: [FinanceController],
  providers: [FinanceService, BudgetService, IntelligenceService],
  exports: [FinanceService, BudgetService, IntelligenceService],
})
export class FinanceModule {}
