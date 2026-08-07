import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { createFamilySchema, createInvitationSchema, updateFamilySchema } from '@ruma/validation';
import { FamiliesService } from './families.service';
import { InvitationsService } from './invitations.service';
import { ActivityService } from './activity.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FamilyMemberGuard } from './family-member.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller()
export class FamiliesController {
  constructor(
    private readonly familiesService: FamiliesService,
    private readonly invitationsService: InvitationsService,
    private readonly activityService: ActivityService,
  ) {}

  @Post('families')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFamilySchema)) body: unknown,
  ) {
    return this.familiesService.create(user.id, body as never);
  }

  @Get('families')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.familiesService.listForUser(user.id);
  }

  @Get('families/:familyId')
  @UseGuards(FamilyMemberGuard, RolesGuard)
  getOne(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.familiesService.getForMember(familyId, user.id);
  }

  @Patch('families/:familyId')
  @UseGuards(FamilyMemberGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateFamilySchema)) body: unknown,
  ) {
    return this.familiesService.update(familyId, user.id, body as never);
  }

  @Get('families/:familyId/members')
  @UseGuards(FamilyMemberGuard, RolesGuard)
  listMembers(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.familiesService.listMembers(familyId, user.id);
  }

  @Delete('families/:familyId/members/:membershipId')
  @UseGuards(FamilyMemberGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  removeMember(
    @Param('familyId') familyId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familiesService.removeMember(familyId, user.id, membershipId);
  }

  @Post('families/:familyId/invitations')
  @UseGuards(FamilyMemberGuard, RolesGuard)
  createInvitation(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInvitationSchema)) body: unknown,
  ) {
    return this.invitationsService.create(familyId, user.id, body as never);
  }

  @Get('families/:familyId/invitations')
  @UseGuards(FamilyMemberGuard, RolesGuard)
  listInvitations(@Param('familyId') familyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitationsService.list(familyId, user.id);
  }

  @Delete('families/:familyId/invitations/:invitationId')
  @UseGuards(FamilyMemberGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  revokeInvitation(
    @Param('familyId') familyId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invitationsService.revoke(familyId, user.id, invitationId);
  }

  @Get('families/:familyId/activity')
  @UseGuards(FamilyMemberGuard, RolesGuard)
  listActivity(@Param('familyId') familyId: string) {
    return this.activityService.listForFamily(familyId);
  }

  @Public()
  @Get('invitations/:token')
  previewInvitation(@Param('token') token: string) {
    return this.invitationsService.preview(token);
  }

  @Post('invitations/:token/accept')
  acceptInvitation(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitationsService.accept(token, user.id);
  }
}
