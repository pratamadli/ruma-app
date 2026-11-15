import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { BudgetService } from './budget.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ImportController } from './imports/import.controller';
import { ImportService } from './imports/import.service';
import { IntelligenceService } from './intelligence/intelligence.service';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { DraftsService } from './automation/drafts.service';
import { AutomationService } from './automation/automation.service';
import { AutomationController, DraftsController } from './automation/automation.controller';
import { TelegramClient } from './automation/telegram.client';
import { HermesGuard, TelegramGuard } from './automation/integration-auth';
import { ReceiptsService } from './receipts/receipts.service';
import { ReceiptsController } from './receipts/receipts.controller';
import { ReceiptStorage } from './receipts/receipt-storage';
import { ReceiptOcr } from './receipts/receipt-ocr';
import { InvestmentsService } from './investments.service';
import { InvestmentsController } from './investments.controller';
import { SchedulesService } from './automation/schedules.service';
import { SchedulesController } from './automation/schedules.controller';

@Module({
  imports: [FamiliesModule],
  controllers: [
    FinanceController,
    ImportController,
    GoalsController,
    DraftsController,
    AutomationController,
    ReceiptsController,
    InvestmentsController,
    SchedulesController,
  ],
  providers: [
    FinanceService,
    BudgetService,
    IntelligenceService,
    ImportService,
    GoalsService,
    DraftsService,
    AutomationService,
    TelegramClient,
    HermesGuard,
    TelegramGuard,
    ReceiptsService,
    ReceiptStorage,
    ReceiptOcr,
    InvestmentsService,
    SchedulesService,
  ],
  exports: [FinanceService, BudgetService, IntelligenceService, ImportService],
})
export class FinanceModule {}
