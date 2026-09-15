/**
 * Sends the finished inspection report by email (PDF attachment) to the
 * inspector who submitted the public form and to the fixed internal
 * recipient (config.REPORT_BCC_EMAIL). No-ops with a log warning when SMTP
 * isn't configured, so a missing mail setup never blocks an inspection from
 * completing.
 */
import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env';
import { logger } from '../utils/logger';

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    logger.warn('email.not_configured', {
      message: 'SMTP_HOST/SMTP_USER/SMTP_PASS not set — inspection report emails will be skipped.',
    });
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  });
  return transporter;
}

const RESULT_LABEL: Record<string, string> = {
  PASS: 'PASSED ✅',
  FAIL: 'FAILED ❌',
  REVIEW: 'NEEDS REVIEW ⚠️',
  INCOMPLETE: 'INCOMPLETE',
};

export interface SendReportParams {
  inspectionId: string;
  aedModel?: string;
  inspectionResult: string;
  guestName?: string;
  guestEmail?: string;
  pdfBuffer: Buffer;
}

export async function sendInspectionReportEmail(params: SendReportParams): Promise<{ sent: boolean; recipients: string[]; reason?: string }> {
  const t = getTransporter();

  const recipients = new Set<string>();
  if (params.guestEmail) recipients.add(params.guestEmail);
  if (config.REPORT_BCC_EMAIL) recipients.add(config.REPORT_BCC_EMAIL);

  if (recipients.size === 0) {
    return { sent: false, recipients: [], reason: 'No recipients' };
  }

  if (!t) {
    return { sent: false, recipients: [...recipients], reason: 'SMTP not configured' };
  }

  const resultLabel = RESULT_LABEL[params.inspectionResult] ?? params.inspectionResult;
  const modelLine = params.aedModel ? `${params.aedModel} — ` : '';

  try {
    await t.sendMail({
      from: config.EMAIL_FROM || config.SMTP_USER,
      to: [...recipients].join(', '),
      subject: `AED Inspection Report — ${modelLine}${resultLabel}`,
      html: `
        <div style="font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #1a1a1a;">
          <h2 style="margin-bottom: 4px;">AED Inspection Report</h2>
          <p style="color: #555; margin-top: 0;">${params.aedModel ?? 'AED'} inspection completed by ${params.guestName ?? 'inspector'}.</p>
          <p><strong>Result:</strong> ${resultLabel}</p>
          <p><strong>Inspection ID:</strong> ${params.inspectionId}</p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">The full report is attached as a PDF.</p>
          <p style="color: #aaa; font-size: 11px; margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px;">
            Powered by Think Healthcare and Safety &middot; inspector.aedsmartx.com
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `aed-inspection-${params.inspectionId}.pdf`,
          content: params.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    logger.info('email.report_sent', { inspectionId: params.inspectionId, recipients: [...recipients] });
    return { sent: true, recipients: [...recipients] };
  } catch (err) {
    logger.error('email.send_failed', {
      inspectionId: params.inspectionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, recipients: [...recipients], reason: 'Send failed' };
  }
}
