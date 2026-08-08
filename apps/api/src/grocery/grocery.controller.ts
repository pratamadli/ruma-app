import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createGroceryItemSchema, updateGroceryItemSchema } from '@ruma/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FamilyMemberGuard } from '../families/family-member.guard';
import { GroceryService } from './grocery.service';

@Controller('families/:familyId/grocery')
@UseGuards(FamilyMemberGuard)
export class GroceryController {
  constructor(private readonly grocery: GroceryService) {}

  @Get()
  getList(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.grocery.getList(familyId, user.id);
  }

  @Post('items')
  addItem(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createGroceryItemSchema)) body: unknown,
  ) {
    return this.grocery.addItem(familyId, user.id, body as never);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('familyId') familyId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateGroceryItemSchema)) body: unknown,
  ) {
    return this.grocery.updateItem(familyId, itemId, user.id, body as never);
  }

  @Delete('items/:itemId')
  @HttpCode(200)
  removeItem(
    @Param('familyId') familyId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grocery.removeItem(familyId, itemId, user.id);
  }

  @Post('clear-completed')
  @HttpCode(200)
  clearCompleted(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.grocery.clearCompleted(familyId, user.id);
  }
}
