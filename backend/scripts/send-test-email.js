// Live Resend verification script.
//
// Usage:
//   npm run email:test -- recipient@example.com
//   npm run email:test -- recipient@example.com --all
//
// The recipient must be the Resend account owner's address while using the
// onboarding@resend.dev test sender, or any address once a domain is verified.
// Add --all to also send the approval and rejected/cancelled/completed status
// templates. This script never prints the API key.

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const {
  getConfig,
  isValidEmail,
  sendAppointmentConfirmation,
  sendAppointmentApproved,
  sendAppointmentStatusUpdate,
  sendAdminNewBookingNotification,
} = require("../src/services/emailService");

async function main() {
  const includeStatuses = process.argv.includes("--all");
  const to = String(
    process.argv.slice(2).find((arg) => !arg.startsWith("--")) ||
      process.env.TEST_EMAIL_TO ||
      process.env.ADMIN_NOTIFICATION_EMAIL ||
      ""
  ).trim();
  const config = getConfig();

  console.log("Resend configuration:");
  console.log(`  enabled: ${config.enabled}`);
  console.log(`  from: ${config.from || "(missing)"}`);
  console.log(`  admin recipients: ${config.adminEmails.length}`);
  console.log(`  support email: ${config.supportEmail}`);
  console.log(`  app url: ${config.appUrl}`);

  if (!config.enabled) {
    console.error("\nRESEND_API_KEY and RESEND_FROM_EMAIL must be configured in backend/.env.");
    process.exitCode = 2;
    return;
  }
  if (!isValidEmail(to)) {
    console.error("\nUsage: npm run email:test -- recipient@example.com");
    console.error("Provide a valid recipient email address.");
    process.exitCode = 2;
    return;
  }

  // Exercise the admin template too. If no admin recipient is configured,
  // use the explicit test recipient for this one-off verification.
  if (!config.adminEmails.length) {
    process.env.ADMIN_NOTIFICATION_EMAIL = to;
  }

  const appointment = {
    reference: `APT-TEST-${Date.now().toString(36).toUpperCase()}`,
    customerName: "BookEase Test Customer",
    customerEmail: to,
    customerPhone: "+977-9800000000",
    service: { name: "General Health Consultation" },
    specialist: { name: "Dr. Test Provider" },
    date: "2099-01-06",
    time: "09:00 AM",
    status: "pending",
    notes: "Automated Resend verification message.",
  };

  console.log(`\nSending live test emails to ${to} ...`);
  const results = [];
  const send = async (label, fn) => {
    const result = await fn();
    results.push({ label, result });
    console.log(`\n${label}:`);
    console.log(JSON.stringify(result));
  };

  await send("Customer booking confirmation", () => sendAppointmentConfirmation(appointment));
  await send("Admin new-booking notification", () => sendAdminNewBookingNotification(appointment));

  if (includeStatuses) {
    await send("Customer appointment approved", () => sendAppointmentApproved({ ...appointment, status: "confirmed" }));

    for (const status of ["rejected", "cancelled", "completed"]) {
      await send(`Customer status update (${status})`, () =>
        sendAppointmentStatusUpdate({ ...appointment, status }, "pending")
      );
    }
  }

  if (results.some(({ result }) => !result.sent)) {
    console.error("\nOne or more live emails were not accepted by Resend.");
    process.exitCode = 1;
  } else {
    console.log("\nLive Resend verification completed successfully.");
  }
}

main().catch((err) => {
  console.error("Live email test failed:", err && err.message ? err.message : err);
  process.exitCode = 1;
});
