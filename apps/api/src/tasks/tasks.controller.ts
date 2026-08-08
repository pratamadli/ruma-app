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
import { createTaskSchema, updateTaskSchema } from '@ruma/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FamilyMemberGuard } from '../families/family-member.guard';
import { TasksService } from './tasks.service';

@Controller('families/:familyId/tasks')
@UseGuards(FamilyMemberGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Param('familyId') familyId: string) {
    return this.tasks.list(familyId);
  }

  @Get(':taskId')
  get(@Param('familyId') familyId: string, @Param('taskId') taskId: string) {
    return this.tasks.get(familyId, taskId);
  }

  @Post()
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTaskSchema)) body: unknown,
  ) {
    return this.tasks.create(familyId, user.id, body as never);
  }

  @Patch(':taskId')
  update(
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: unknown,
  ) {
    return this.tasks.update(familyId, taskId, user.id, body as never);
  }

  @Delete(':taskId')
  @HttpCode(200)
  remove(@Param('familyId') familyId: string, @Param('taskId') taskId: string) {
    return this.tasks.remove(familyId, taskId);
  }
}
