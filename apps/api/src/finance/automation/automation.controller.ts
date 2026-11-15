import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  draftInputSchema,
  hermesToolSchema,
  telegramIdSchema,
  telegramConnectSchema,
  telegramUpdateSchema,
  type DraftInput,
  type HermesToolInput,
  type TelegramUpdate,
  type TelegramConnectInput,
} from '@ruma/validation';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FamilyMemberGuard } from '../../families/family-member.guard';
import { AutomationService } from './automation.service';
import { DraftsService } from './drafts.service';
import { HermesGuard, TelegramGuard } from './integration-auth';

@Controller('families/:familyId/finance')
@UseGuards(FamilyMemberGuard)
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}
  @Get('drafts')
  list(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.drafts.list(familyId, user.id);
  }
  @Post('drafts')
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(draftInputSchema)) input: DraftInput,
  ) {
    return this.drafts.create(familyId, user.id, input, 'MANUAL');
  }
  @Post('drafts/:id/confirm')
  confirm(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.drafts.confirm(familyId, user.id, id);
  }
  @Patch('drafts/:id')
  replace(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(draftInputSchema)) input: DraftInput,
  ) {
    return this.drafts.replace(familyId, user.id, id, input);
  }
  @Delete('drafts/:id')
  cancel(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.drafts.cancel(familyId, user.id, id);
  }
  @Get('telegram')
  status(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.drafts.linkStatus(familyId, user.id);
  }
  @Post('telegram/link')
  link(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.drafts.createLinkCode(familyId, user.id);
  }
  @Delete('telegram/link')
  unlink(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.drafts.unlink(familyId, user.id);
  }
}

function verifiedTelegramId(telegramId: string) {
  const parsed = telegramIdSchema.safeParse(telegramId);
  if (!parsed.success)
    throw new BadRequestException({
      code: 'INVALID_TELEGRAM_ID',
      message: 'A numeric Telegram identity is required.',
    });
  return parsed.data;
}

@Controller('integrations')
export class AutomationController {
  constructor(
    private readonly automation: AutomationService,
    private readonly drafts: DraftsService,
  ) {}
  @Post('hermes/telegram/connect')
  @Public()
  @UseGuards(HermesGuard)
  connect(
    @Headers('x-telegram-user-id') telegramId: string,
    @Body(new ZodValidationPipe(telegramConnectSchema)) input: TelegramConnectInput,
  ) {
    return this.drafts.consumeLink(input, verifiedTelegramId(telegramId));
  }
  @Get('hermes/telegram/connection')
  @Public()
  @UseGuards(HermesGuard)
  async connection(@Headers('x-telegram-user-id') telegramId: string) {
    const connection = await this.drafts.connection(verifiedTelegramId(telegramId));
    return { linked: true, household: connection.household };
  }
  @Delete('hermes/telegram/connection')
  @Public()
  @UseGuards(HermesGuard)
  async disconnect(@Headers('x-telegram-user-id') telegramId: string) {
    const connection = await this.drafts.connection(verifiedTelegramId(telegramId));
    return this.drafts.unlink(connection.household.id, connection.userId);
  }
  @Post('hermes/tools')
  @Public()
  @UseGuards(HermesGuard)
  tools(
    @Headers('x-telegram-user-id') telegramId: string,
    @Body(new ZodValidationPipe(hermesToolSchema)) input: HermesToolInput,
  ) {
    return this.automation.tool(verifiedTelegramId(telegramId), input);
  }

  @Post('telegram/webhook')
  @HttpCode(200)
  @Public()
  @UseGuards(TelegramGuard)
  webhook(@Body(new ZodValidationPipe(telegramUpdateSchema)) input: TelegramUpdate) {
    return this.automation.webhook(input);
  }
}
