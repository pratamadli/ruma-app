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
  bulkImportCandidatesSchema,
  completeGmailOAuthSchema,
  confirmImportCandidateSchema,
  connectSyntheticEmailSchema,
  importSyncSchema,
  listImportCandidatesQuerySchema,
  updateImportCandidateSchema,
} from '@ruma/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { FamilyMemberGuard } from '../../families/family-member.guard';
import { RolesGuard } from '../../families/roles.guard';
import { ImportService } from './import.service';

@Controller('families/:familyId')
@UseGuards(FamilyMemberGuard)
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Get('integrations/email')
  listConnections(@Param('familyId') familyId: string) {
    return this.imports.listConnections(familyId);
  }

  @Post('integrations/email/synthetic')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  connectSynthetic(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(connectSyntheticEmailSchema)) body: unknown,
  ) {
    return this.imports.connectSynthetic(familyId, user.id, body as never);
  }

  @Get('integrations/email/gmail/auth-url')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  gmailAuthUrl(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.imports.getGmailAuthUrl(familyId, user.id);
  }

  @Post('integrations/email/gmail')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  completeGmail(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(completeGmailOAuthSchema)) body: unknown,
  ) {
    return this.imports.completeGmailOAuth(familyId, user.id, body as never);
  }

  @Delete('integrations/email/:connectionId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(200)
  disconnect(@Param('familyId') familyId: string, @Param('connectionId') connectionId: string) {
    return this.imports.disconnect(familyId, connectionId);
  }

  @Post('integrations/email/:connectionId/sync')
  sync(
    @Param('familyId') familyId: string,
    @Param('connectionId') connectionId: string,
    @Body(new ZodValidationPipe(importSyncSchema)) body: unknown,
  ) {
    return this.imports.sync(familyId, connectionId, body as never);
  }

  @Get('finance/imports')
  listImports(
    @Param('familyId') familyId: string,
    @Query(new ZodValidationPipe(listImportCandidatesQuerySchema)) query: unknown,
  ) {
    return this.imports.listCandidates(familyId, query as never);
  }

  @Post('finance/imports/bulk-ignore')
  @HttpCode(200)
  bulkIgnore(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(bulkImportCandidatesSchema)) body: unknown,
  ) {
    return this.imports.bulkIgnore(familyId, user.id, body as never);
  }

  @Get('finance/imports/:candidateId')
  getImport(@Param('familyId') familyId: string, @Param('candidateId') candidateId: string) {
    return this.imports.getCandidate(familyId, candidateId);
  }

  @Patch('finance/imports/:candidateId')
  updateImport(
    @Param('familyId') familyId: string,
    @Param('candidateId') candidateId: string,
    @Body(new ZodValidationPipe(updateImportCandidateSchema)) body: unknown,
  ) {
    return this.imports.updateCandidate(familyId, candidateId, body as never);
  }

  @Post('finance/imports/:candidateId/confirm')
  confirmImport(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('candidateId') candidateId: string,
    @Body(new ZodValidationPipe(confirmImportCandidateSchema)) body: unknown,
  ) {
    return this.imports.confirm(familyId, user.id, candidateId, body as never);
  }

  @Post('finance/imports/:candidateId/ignore')
  @HttpCode(200)
  ignoreImport(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('candidateId') candidateId: string,
  ) {
    return this.imports.ignore(familyId, user.id, candidateId);
  }
}
