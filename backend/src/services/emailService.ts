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

/** Names and the like are typed by anonymous visitors; in an HTML email they
 *  must render as text, never as markup (a "name" carrying a link or a fake
 *  login form would otherwise arrive in our own inbox looking like ours). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  /** Readiness score out of 100. */
  score?: number;
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
      subject: `AED Inspection Report — ${modelLine}${resultLabel}${
        params.score !== undefined ? ` (${params.score}/100)` : ''
      }`,
      html: `
        <div style="font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #1a1a1a;">
          <p style="margin: 0 0 20px;">
            <img src="https://inspector.aedsmartx.com/brand/aedsmartx.png" alt="aedsmartx" height="20" style="height: 20px; vertical-align: middle;" />
            <span style="color: #ccc; margin: 0 8px; vertical-align: middle;">|</span>
            <span style="font-weight: 600; vertical-align: middle;">Inspector</span>
          </p>
          <h2 style="margin-bottom: 4px;">AED Inspection Report</h2>
          <p style="color: #555; margin-top: 0;">${escapeHtml(params.aedModel ?? 'AED')} inspection completed by ${escapeHtml(params.guestName ?? 'inspector')}.</p>
          <p><strong>Result:</strong> ${resultLabel}</p>
          ${params.score !== undefined ? `<p><strong>Readiness score:</strong> ${params.score}/100 (80 needed to pass)</p>` : ''}
          <p><strong>Inspection ID:</strong> ${params.inspectionId}</p>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">The full report is attached as a PDF.</p>
          <p style="color: #aaa; font-size: 11px; margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px;">
            aedsmartx Inspector &middot; A Think Health&trade; product &middot;
            <a href="https://aedsmartx.com" style="color: #aaa;">aedsmartx.com</a> &middot;
            <a href="https://thinkhealth.in" style="color: #aaa;">thinkhealth.in</a>
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

export interface ReplacementRequestParams {
  inspectionId: string;
  items: string[];
  aedModel?: string;
  serialNumber?: string;
  padsExpiry?: string;
  batteryExpiry?: string;
  inspectionResult: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
}

const REPLACEMENT_LABEL: Record<string, string> = {
  pads: 'Pads',
  battery: 'Battery',
  accessories: 'Spares / accessories',
};

/**
 * Tells the sales team a customer has asked, from their result screen, to be
 * quoted for replacements. Internal address only — the customer already has
 * their report — with Reply-To set to the customer, so answering the email
 * answers them.
 */
export async function sendReplacementRequestEmail(
  params: ReplacementRequestParams,
): Promise<{ sent: boolean; reason?: string }> {
  const t = getTransporter();
  const to = config.REPORT_BCC_EMAIL;
  if (!to) return { sent: false, reason: 'No recipient' };
  if (!t) return { sent: false, reason: 'SMTP not configured' };

  const wanted = params.items.map((i) => REPLACEMENT_LABEL[i] ?? i).join(', ');
  const rows: [string, string | undefined][] = [
    ['Wants a quote for', wanted],
    ['Name', params.guestName],
    ['Phone', params.guestPhone],
    ['Email', params.guestEmail],
    ['AED model', params.aedModel],
    ['Serial number', params.serialNumber],
    ['Pads expiry', params.padsExpiry],
    ['Battery expiry', params.batteryExpiry],
    ['Inspection result', params.inspectionResult],
    ['Inspection ID', params.inspectionId],
  ];
  const phoneDigits = params.guestPhone?.replace(/\D/g, '');

  try {
    await t.sendMail({
      from: config.EMAIL_FROM || config.SMTP_USER,
      to,
      replyTo: params.guestEmail || undefined,
      subject: `Quote request: ${wanted} for ${params.aedModel ?? 'AED'} (${params.guestName ?? 'customer'})`,
      html: `
        <div style="font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #1a1a1a;">
          <h2 style="margin-bottom: 4px;">New replacement quote request</h2>
          <p style="color: #555; margin-top: 0;">Asked for from the inspection result screen. Reply to this email to reach the customer.</p>
          <table cellpadding="6" style="border-collapse: collapse; margin-top: 12px;">
            ${rows
              .map(
                ([label, value]) => `
              <tr>
                <td style="color: #777; padding-right: 16px; vertical-align: top;">${escapeHtml(label)}</td>
                <td style="font-weight: 600;">${escapeHtml(value || '—')}</td>
              </tr>`,
              )
              .join('')}
          </table>
          ${
            phoneDigits
              ? `<p style="margin-top: 16px;"><a href="tel:+${phoneDigits}">Call</a> &middot; <a href="https://wa.me/${phoneDigits}">WhatsApp</a></p>`
              : ''
          }
        </div>
      `,
    });
    logger.info('email.replacement_request_sent', { inspectionId: params.inspectionId });
    return { sent: true };
  } catch (err) {
    logger.error('email.replacement_request_failed', {
      inspectionId: params.inspectionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: 'Send failed' };
  }
}

export interface ModelRequestParams {
  name: string;
  email: string;
  phone: string;
  brand: string;
  model?: string;
}

/**
 * Tells the sales team that someone with an AED the app doesn't cover yet
 * asked for help with it. Internal address only; Reply-To is the visitor.
 */
export async function sendModelRequestEmail(params: ModelRequestParams): Promise<{ sent: boolean; reason?: string }> {
  const t = getTransporter();
  const to = config.REPORT_BCC_EMAIL;
  if (!to) return { sent: false, reason: 'No recipient' };
  if (!t) return { sent: false, reason: 'SMTP not configured' };

  const unit = [params.brand, params.model].filter(Boolean).join(' ');
  const rows: [string, string | undefined][] = [
    ['AED', unit],
    ['Name', params.name],
    ['Phone', params.phone],
    ['Email', params.email],
  ];
  const phoneDigits = params.phone.replace(/\D/g, '');

  try {
    await t.sendMail({
      from: config.EMAIL_FROM || config.SMTP_USER,
      to,
      replyTo: params.email || undefined,
      subject: `Unsupported AED: ${unit} (${params.name})`,
      html: `
        <div style="font-family: -apple-system, Arial, sans-serif; font-size: 14px; color: #1a1a1a;">
          <h2 style="margin-bottom: 4px;">An owner of an unlisted AED asked for help</h2>
          <p style="color: #555; margin-top: 0;">Their model isn't in the app yet, so they couldn't run the inspection themselves. Reply to this email to reach them.</p>
          <table cellpadding="6" style="border-collapse: collapse; margin-top: 12px;">
            ${rows
              .map(
                ([label, value]) => `
              <tr>
                <td style="color: #777; padding-right: 16px; vertical-align: top;">${escapeHtml(label)}</td>
                <td style="font-weight: 600;">${escapeHtml(value || '—')}</td>
              </tr>`,
              )
              .join('')}
          </table>
          ${
            phoneDigits
              ? `<p style="margin-top: 16px;"><a href="tel:+${phoneDigits}">Call</a> &middot; <a href="https://wa.me/${phoneDigits}">WhatsApp</a></p>`
              : ''
          }
        </div>
      `,
    });
    logger.info('email.model_request_sent', { brand: params.brand });
    return { sent: true };
  } catch (err) {
    logger.error('email.model_request_failed', {
      brand: params.brand,
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: 'Send failed' };
  }
}
