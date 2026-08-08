import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { GroceryController } from './grocery.controller';
import { GroceryService } from './grocery.service';

@Module({
  imports: [FamiliesModule],
  controllers: [GroceryController],
  providers: [GroceryService],
  exports: [GroceryService],
})
export class GroceryModule {}
