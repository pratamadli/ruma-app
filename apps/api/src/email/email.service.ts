import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { loadApiEnv } from '../config/env';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly env = loadApiEnv();
  private readonly resend = this.env.RESEND_API_KEY ? new Resend(this.env.RESEND_API_KEY) : null;

  async sendFamilyInvitation(input: {
    to: string;
    familyName: string;
    inviterName: string;
    acceptUrl: string;
  }): Promise<void> {
    const subject = `You've been invited to join ${input.familyName} on RUMA`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #191919;">
        <p>Hi,</p>
        <p><strong>${input.inviterName}</strong> invited you to join
        <strong>${input.familyName}</strong> on RUMA.</p>
        <p><a href="${input.acceptUrl}" style="display:inline-block;padding:12px 18px;background:#191919;color:#F8F7F4;text-decoration:none;border-radius:10px;">
          Accept invitation
        </a></p>
        <p style="color:#5c5a55;font-size:14px;">This invitation expires soon. If you weren’t expecting it, you can ignore this email.</p>
      </div>
    `;

    if (!this.resend) {
      this.logger.log(`[dev-email] To: ${input.to} | ${subject} | ${input.acceptUrl}`);
      return;
    }

    const result = await this.resend.emails.send({
      from: this.env.EMAIL_FROM,
      to: input.to,
      subject,
      html,
    });

    if (result.error) {
      this.logger.error(`Failed to send invitation email: ${result.error.message}`);
      throw new Error('Failed to send invitation email');
    }
  }

  async sendPasswordReset(input: { to: string; resetUrl: string }): Promise<void> {
    const subject = 'Reset your RUMA password';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #191919;">
        <p>Hi,</p>
        <p>We received a request to reset your RUMA password.</p>
        <p><a href="${input.resetUrl}" style="display:inline-block;padding:12px 18px;background:#191919;color:#F8F7F4;text-decoration:none;border-radius:10px;">
          Reset password
        </a></p>
        <p style="color:#5c5a55;font-size:14px;">This link expires soon and can only be used once. If you didn’t request a reset, you can ignore this email.</p>
      </div>
    `;

    if (!this.resend) {
      this.logger.log(`[dev-email] To: ${input.to} | ${subject} | ${input.resetUrl}`);
      return;
    }

    const result = await this.resend.emails.send({
      from: this.env.EMAIL_FROM,
      to: input.to,
      subject,
      html,
    });

    if (result.error) {
      this.logger.error(`Failed to send password reset email: ${result.error.message}`);
      throw new Error('Failed to send password reset email');
    }
  }
}
