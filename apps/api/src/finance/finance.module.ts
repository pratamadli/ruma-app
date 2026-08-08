import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { BudgetService } from './budget.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ImportController } from './imports/import.controller';
import { ImportService } from './imports/import.service';
import { IntelligenceService } from './intelligence/intelligence.service';

@Module({
  imports: [FamiliesModule],
  controllers: [FinanceController, ImportController],
  providers: [FinanceService, BudgetService, IntelligenceService, ImportService],
  exports: [FinanceService, BudgetService, IntelligenceService, ImportService],
})
export class FinanceModule {}
