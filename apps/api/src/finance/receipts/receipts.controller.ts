import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { draftInputSchema, financeScopeSchema, type DraftInput } from '@ruma/validation';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FamilyMemberGuard } from '../../families/family-member.guard';
import { RECEIPT_MAX_BYTES } from './receipt-storage';
import { ReceiptsService } from './receipts.service';

const uploadSchema = z.object({ scope: financeScopeSchema });

@Controller('families/:familyId/finance/receipts')
@UseGuards(FamilyMemberGuard)
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}
  @Get()
  list(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receipts.list(familyId, user.id);
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: RECEIPT_MAX_BYTES, files: 1, fields: 1 } }),
  )
  upload(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(uploadSchema)) body: z.infer<typeof uploadSchema>,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    if (!file)
      throw new BadRequestException({
        code: 'RECEIPT_REQUIRED',
        message: 'Choose a receipt image.',
      });
    return this.receipts.upload(familyId, user.id, body.scope, file);
  }
  @Get(':id/file')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async file(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new StreamableFile(await this.receipts.file(familyId, user.id, id), {
      type: 'image/jpeg',
      disposition: 'attachment; filename="receipt.jpg"',
    });
  }
  @Post(':id/draft')
  draft(
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(draftInputSchema)) input: DraftInput,
  ) {
    return this.receipts.draft(familyId, user.id, id, input);
  }
}
