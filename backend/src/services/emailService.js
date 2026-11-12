// Resend email notifications (best-effort).
//
// This module is isolated so appointment booking/status logic never depends on
// email delivery. Callers must treat email as a side effect: failures are
// caught and logged here so a saved appointment is never rolled back.
//
// Environment variables:
// - RESEND_API_KEY: Resend API key (never log or expose this value)
// - RESEND_FROM_EMAIL: verified sender, e.g. "BookEase <no-reply@example.com>"
// - ADMIN_NOTIFICATION_EMAIL: admin recipient(s), comma-separated
// - EMAIL_REPLY_TO (optional): reply-to address
// - SUPPORT_EMAIL (optional): support address shown in the email footer
// - APP_NAME (optional): brand name, defaults to "BookEase"
// - APP_URL / FRONTEND_URL (optional): used for dashboard/appointment links

let ResendClient;
try {
  // Optional dependency at runtime; installed via package.json.
  ({ Resend: ResendClient } = require("resend"));
} catch (_err) {
  ResendClient = null;
}

const DEFAULT_APP_NAME = "BookEase";
const DEFAULT_APP_URL = "http://localhost:5173";
const DEFAULT_SUPPORT_EMAIL = "hello@bookease.com.np";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEnv(name) {
  return process.env[name] ? String(process.env[name]).trim() : "";
}

function splitEmailList(value) {
  return String(value ?? "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidEmail(value) {
  const email = String(value ?? "").trim();
  return email.length > 3 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

function normalizeRecipients(to) {
  const raw = Array.isArray(to) ? to : splitEmailList(to);
  const valid = [];
  const invalid = [];

  for (const item of raw) {
    const value = String(item ?? "").trim();
    if (!value) continue;
    if (isValidEmail(value)) {
      if (!valid.includes(value)) valid.push(value);
    } else {
      invalid.push(value);
    }
  }

  return { valid, invalid };
}

function getConfig() {
  const apiKey = readEnv("RESEND_API_KEY");
  const from = readEnv("RESEND_FROM_EMAIL");
  const adminEmails = splitEmailList(process.env.ADMIN_NOTIFICATION_EMAIL);
  const replyTo = readEnv("EMAIL_REPLY_TO");
  const supportEmail = readEnv("SUPPORT_EMAIL") || DEFAULT_SUPPORT_EMAIL;
  const appName = readEnv("APP_NAME") || DEFAULT_APP_NAME;
  const appUrl = (readEnv("APP_URL") || readEnv("FRONTEND_URL") || DEFAULT_APP_URL).replace(/\/+$/, "");

  return {
    apiKey,
    from,
    adminEmails,
    adminEmail: adminEmails[0] || "",
    replyTo,
    supportEmail,
    appName,
    appUrl,
    enabled: Boolean(apiKey && from && ResendClient),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().replace(/\/+$/, "") : "";
  } catch (_err) {
    return "";
  }
}

function sanitizeSubject(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 200);
}

const STATUS_META = {
  pending: {
    label: "Pending",
    heading: "Appointment booked",
    subject: "Booking received",
    accent: "#b45309",
    background: "#fef3c7",
    message: "We have received your booking request and will review it shortly.",
  },
  confirmed: {
    label: "Confirmed",
    heading: "Appointment confirmed",
    subject: "Appointment confirmed",
    accent: "#047857",
    background: "#d1fae5",
    message: "Your appointment has been confirmed. Please arrive a few minutes early.",
  },
  completed: {
    label: "Completed",
    heading: "Appointment completed",
    subject: "Appointment completed",
    accent: "#1d4ed8",
    background: "#dbeafe",
    message: "Your appointment has been marked as completed. Thank you for visiting.",
  },
  cancelled: {
    label: "Cancelled",
    heading: "Appointment cancelled",
    subject: "Appointment cancelled",
    accent: "#b91c1c",
    background: "#fee2e2",
    message: "Your appointment has been cancelled. You can book a new appointment at any time.",
  },
  rejected: {
    label: "Rejected",
    heading: "Appointment request rejected",
    subject: "Appointment request rejected",
    accent: "#b91c1c",
    background: "#fee2e2",
    message: "Unfortunately, your appointment request could not be accepted. Please contact us or book another time.",
  },
};

function getStatusMeta(status) {
  const key = String(status || "").trim().toLowerCase();
  return (
    STATUS_META[key] || {
      label: key ? key.charAt(0).toUpperCase() + key.slice(1) : "Updated",
      heading: "Appointment update",
      subject: "Appointment update",
      accent: "#334155",
      background: "#e2e8f0",
      message: "Your appointment details have been updated.",
    }
  );
}

function getDetails(appt) {
  const serviceName = appt?.service && typeof appt.service === "object" ? appt.service.name : appt?.service;
  const specialistName =
    appt?.specialist && typeof appt.specialist === "object"
      ? appt.specialist.name
      : appt?.specialist || appt?.provider;

  return {
    reference: String(appt?.reference || appt?.id || ""),
    customerName: String(appt?.customerName || appt?.customer || ""),
    customerEmail: String(appt?.customerEmail || appt?.email || "").trim().toLowerCase(),
    customerPhone: String(appt?.customerPhone || appt?.phone || ""),
    service: String(serviceName || ""),
    specialist: String(specialistName || ""),
    date: String(appt?.date || ""),
    time: String(appt?.time || ""),
    status: String(appt?.status || "").trim().toLowerCase(),
    notes: String(appt?.notes || ""),
  };
}

function appointmentRows(details, options = {}) {
  const rows = [
    ["Booking reference", details.reference],
    ["Service", details.service],
    ["Provider", details.specialist],
    ["Date", details.date],
    ["Time", details.time],
    ["Status", getStatusMeta(details.status).label],
  ];

  if (options.previousStatus && options.previousStatus !== details.status) {
    rows.push(["Previous status", getStatusMeta(options.previousStatus).label]);
  }

  return rows.filter(([, value]) => String(value ?? "").trim() !== "");
}

function renderRows(rows) {
  return rows
    .map(
      ([label, value]) => `
        <tr class="detail-row">
          <td class="detail-label" style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:42%;vertical-align:top;">${escapeHtml(label)}</td>
          <td class="detail-value" style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");
}

function renderLayout({
  preheader,
  heading,
  intro,
  statusMeta,
  rows,
  extraHtml = "",
  ctaUrl,
  ctaLabel,
  appName,
  appUrl,
  supportEmail,
}) {
  const safeCtaUrl = safeUrl(ctaUrl || appUrl);
  const cta =
    safeCtaUrl && ctaLabel
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
           <tr>
             <td style="border-radius:999px;background:#0f766e;">
               <a href="${escapeHtml(safeCtaUrl)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(ctaLabel)}</a>
             </td>
           </tr>
         </table>`
      : "";
  const badge = statusMeta
    ? `<span style="display:inline-block;margin:4px 0 8px;padding:6px 12px;border-radius:999px;background:${statusMeta.background};color:${statusMeta.accent};font-size:13px;font-weight:700;">${escapeHtml(statusMeta.label)}</span>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
    <style>
      body { margin: 0; padding: 0; background: #f1f5f9; }
      a { color: #0f766e; }
      @media only screen and (max-width: 600px) {
        .email-container { width: 100% !important; }
        .px { padding-left: 20px !important; padding-right: 20px !important; }
        .detail-row { display: block !important; padding: 8px 0 !important; border-bottom: 1px solid #e2e8f0; }
        .detail-label, .detail-value { display: block !important; width: 100% !important; padding: 0 !important; border: 0 !important; }
        .detail-value { margin-top: 3px; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#0f766e;padding:24px 32px;">
                <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(appName)}</p>
                <p style="margin:4px 0 0;color:#ccfbf1;font-size:13px;">Appointments made easy</p>
              </td>
            </tr>
            <tr>
              <td class="px" style="padding:32px;">
                <h1 style="margin:0 0 12px;color:#0f172a;font-size:24px;line-height:1.25;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
                ${badge}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 4px;">
                  ${renderRows(rows)}
                </table>
                ${extraHtml}
                ${cta}
              </td>
            </tr>
            <tr>
              <td class="px" style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px;color:#334155;font-size:13px;font-weight:700;">${escapeHtml(appName)} &middot; Appointment &amp; Service Booking</p>
                <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">Need help? Contact us at <a href="mailto:${escapeHtml(supportEmail)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(supportEmail)}</a>.</p>
                <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">This is an automated message. Please do not reply directly to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText({ heading, intro, statusMeta, rows, ctaUrl, ctaLabel, appName, supportEmail }) {
  const lines = [heading, "", intro];

  if (statusMeta) lines.push("", `Status: ${statusMeta.label}`);
  if (rows.length) {
    lines.push("");
    for (const [label, value] of rows) lines.push(`${label}: ${value}`);
  }
  if (ctaUrl && ctaLabel) lines.push("", `${ctaLabel}: ${ctaUrl}`);
  lines.push("", `${appName} - Appointment & Service Booking`, `Support: ${supportEmail}`, "This is an automated message.");

  return lines.join("\n");
}

async function safeSend({ to, subject, html, text, label = "email" }) {
  const config = getConfig();

  if (!config.enabled) {
    if (!ResendClient) {
      console.warn("[email] Resend package is not available; skipping email.");
    } else {
      console.warn("[email] RESEND_API_KEY/RESEND_FROM_EMAIL not configured; skipping email.");
    }
    return { sent: false, skipped: true, reason: "not-configured" };
  }

  const { valid, invalid } = normalizeRecipients(to);
  if (invalid.length) {
    console.warn(`[email] Ignoring ${invalid.length} invalid recipient address(es) for ${label}.`);
  }
  if (!valid.length) {
    console.warn(`[email] No valid recipient for ${label}; skipping email.`);
    return { sent: false, skipped: true, reason: "invalid-recipient" };
  }

  try {
    const resend = new ResendClient(config.apiKey);
    const payload = {
      from: config.from,
      to: valid,
      subject,
      html,
      text,
    };
    if (isValidEmail(config.replyTo)) payload.replyTo = config.replyTo;

    const result = await resend.emails.send(payload);
    if (result && result.error) {
      console.error(`[email] Resend returned an error for ${label}:`, result.error.message || "unknown error");
      return { sent: false, error: result.error.message || "Email provider error" };
    }

    return { sent: true, id: result?.data?.id || null, recipients: valid.length };
  } catch (err) {
    // Never include secrets. Keep the message useful for debugging.
    console.error(`[email] Failed to send ${label}:`, err && err.message ? err.message : err);
    return { sent: false, error: err && err.message ? err.message : "Email send failed" };
  }
}

function buildCustomerEmail({ details, statusMeta, heading, intro, previousStatus, ctaLabel, ctaUrl }) {
  const config = getConfig();
  const rows = appointmentRows(details, { previousStatus });
  const html = renderLayout({
    preheader: intro,
    heading,
    intro,
    statusMeta,
    rows,
    ctaUrl,
    ctaLabel,
    appName: config.appName,
    appUrl: config.appUrl,
    supportEmail: config.supportEmail,
  });
  const text = renderText({
    heading,
    intro,
    statusMeta,
    rows,
    ctaUrl,
    ctaLabel,
    appName: config.appName,
    supportEmail: config.supportEmail,
  });

  return { html, text, config };
}

async function sendAppointmentConfirmation(appointment) {
  const details = getDetails(appointment);
  details.status = details.status || "pending";
  const statusMeta = getStatusMeta(details.status);
  const heading = "Appointment booked successfully";
  const intro = `Hi ${details.customerName || "there"}, your appointment has been booked successfully. We have received your request and will review it shortly.`;
  const ctaLabel = "View my appointments";
  const ctaUrl = `${getConfig().appUrl}/customer/appointments`;
  const subject = sanitizeSubject(
    `${statusMeta.subject}: ${details.service || "appointment"} (${details.reference || "booking"})`
  );
  const { html, text } = buildCustomerEmail({ details, statusMeta, heading, intro, ctaLabel, ctaUrl });

  return safeSend({ to: details.customerEmail, subject, html, text, label: "booking confirmation" });
}

async function sendAppointmentApproved(appointment) {
  const details = getDetails(appointment);
  details.status = "confirmed";
  const statusMeta = getStatusMeta("confirmed");
  const heading = "Appointment confirmed";
  const intro = `Hi ${details.customerName || "there"}, good news — your appointment has been confirmed. Please arrive a few minutes early and keep your booking reference handy.`;
  const ctaLabel = "View my appointments";
  const ctaUrl = `${getConfig().appUrl}/customer/appointments`;
  const subject = sanitizeSubject(
    `${statusMeta.subject}: ${details.service || "appointment"} (${details.reference || "booking"})`
  );
  const { html, text } = buildCustomerEmail({ details, statusMeta, heading, intro, ctaLabel, ctaUrl });

  return safeSend({ to: details.customerEmail, subject, html, text, label: "appointment approval" });
}

async function sendAppointmentStatusUpdate(appointment, previousStatus) {
  const details = getDetails(appointment);
  const currentStatus = details.status;
  const previous = String(previousStatus || "").trim().toLowerCase();

  // Never send a status email when nothing actually changed.
  if (previous && currentStatus && previous === currentStatus) {
    return { sent: false, skipped: true, reason: "status-unchanged" };
  }

  const statusMeta = getStatusMeta(currentStatus);
  const previousMeta = previous ? getStatusMeta(previous) : null;
  const heading = statusMeta.heading;
  const intro =
    previousMeta && previous !== currentStatus
      ? `Hi ${details.customerName || "there"}, your appointment status has changed from ${previousMeta.label} to ${statusMeta.label}. ${statusMeta.message}`
      : `Hi ${details.customerName || "there"}, ${statusMeta.message}`;
  const ctaLabel = "View my appointments";
  const ctaUrl = `${getConfig().appUrl}/customer/appointments`;
  const subject = sanitizeSubject(
    `${statusMeta.subject}: ${details.service || "appointment"} (${details.reference || "booking"})`
  );
  const { html, text } = buildCustomerEmail({
    details,
    statusMeta,
    heading,
    intro,
    previousStatus: previous || undefined,
    ctaLabel,
    ctaUrl,
  });

  return safeSend({ to: details.customerEmail, subject, html, text, label: `status update (${currentStatus || "unknown"})` });
}

async function sendAdminNewBookingNotification(appointment) {
  const config = getConfig();
  const details = getDetails(appointment);
  details.status = details.status || "pending";

  if (!config.adminEmails.length) {
    console.warn("[email] ADMIN_NOTIFICATION_EMAIL not configured; skipping admin notification.");
    return { sent: false, skipped: true, reason: "admin-not-configured" };
  }

  const statusMeta = getStatusMeta(details.status);
  const heading = "New appointment booking";
  const intro = `A new appointment has been booked by ${details.customerName || "a customer"}. Review the request and confirm or reject it from the admin dashboard.`;
  const rows = [
    ["Booking reference", details.reference],
    ["Customer", details.customerName],
    ["Customer email", details.customerEmail],
    ["Customer phone", details.customerPhone],
    ["Service", details.service],
    ["Provider", details.specialist],
    ["Date", details.date],
    ["Time", details.time],
    ["Status", statusMeta.label],
    ["Notes", details.notes],
  ].filter(([, value]) => String(value ?? "").trim() !== "");
  const ctaLabel = "Open admin dashboard";
  const ctaUrl = `${config.appUrl}/admin/appointments`;
  const subject = sanitizeSubject(
    `New booking: ${details.service || "appointment"} — ${details.customerName || "customer"} (${details.reference || "booking"})`
  );

  const html = renderLayout({
    preheader: intro,
    heading,
    intro,
    statusMeta,
    rows,
    ctaUrl,
    ctaLabel,
    appName: config.appName,
    appUrl: config.appUrl,
    supportEmail: config.supportEmail,
  });
  const text = renderText({
    heading,
    intro,
    statusMeta,
    rows,
    ctaUrl,
    ctaLabel,
    appName: config.appName,
    supportEmail: config.supportEmail,
  });

  return safeSend({
    to: config.adminEmails,
    subject,
    html,
    text,
    label: "admin new-booking notification",
  });
}

module.exports = {
  getConfig,
  getStatusMeta,
  isValidEmail,
  normalizeRecipients,
  sendAppointmentConfirmation,
  sendAppointmentApproved,
  sendAppointmentStatusUpdate,
  sendAdminNewBookingNotification,
};
