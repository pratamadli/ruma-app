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
import { createFamilyEventSchema, updateFamilyEventSchema } from '@ruma/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FamilyMemberGuard } from '../families/family-member.guard';
import { CalendarService } from './calendar.service';

@Controller('families/:familyId/events')
@UseGuards(FamilyMemberGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  list(@Param('familyId') familyId: string, @Query('from') from?: string) {
    return this.calendar.list(familyId, from);
  }

  @Post()
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFamilyEventSchema)) body: unknown,
  ) {
    return this.calendar.create(familyId, user.id, body as never);
  }

  @Patch(':eventId')
  update(
    @Param('familyId') familyId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateFamilyEventSchema)) body: unknown,
  ) {
    return this.calendar.update(familyId, eventId, user.id, body as never);
  }

  @Delete(':eventId')
  @HttpCode(200)
  remove(
    @Param('familyId') familyId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendar.remove(familyId, eventId, user.id);
  }
}
