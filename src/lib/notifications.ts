import { prisma } from "./db";

export type NotificationTemplate =
  | "booking_confirmation"
  | "booking_reminder"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "staff_invited";

interface QueueInput {
  businessId: string;
  channel: "email" | "sms" | "whatsapp";
  recipient: string;
  template: NotificationTemplate;
  payload: Record<string, unknown>;
}

/**
 * Writes a notification row and attempts immediate delivery. No queue
 * worker/cron exists in this codebase yet — this call is synchronous and
 * best-effort, which is fine for a first cut but should move to a real job
 * queue (e.g. a Vercel Cron hitting a `/api/internal/dispatch-notifications`
 * endpoint) once volume matters. Failures here never block the booking
 * transaction that triggered them — every call site wraps this in try/catch.
 */
export async function queueNotification(input: QueueInput) {
  const notification = await prisma.notification.create({
    data: {
      businessId: input.businessId,
      channel: input.channel,
      recipient: input.recipient,
      template: input.template,
      payload: input.payload as any,
      status: "PENDING",
    },
  });

  try {
    await sendViaAdapter(notification.channel, notification.recipient, input.template, input.payload);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (err) {
    console.error("notification delivery failed", err);
    await prisma.notification.update({ where: { id: notification.id }, data: { status: "FAILED" } });
  }

  return notification;
}

/**
 * THE PLACEHOLDER ADAPTER. This does not actually send anything — it logs
 * what would have been sent, so the rest of the system (queueing, audit,
 * retry semantics) can be built and tested without a provider account.
 * Replace this function with real calls (Resend for email, Twilio or
 * Africa's Talking for SMS, the WhatsApp Business API) when credentials are
 * available. Every call site in this codebase goes through
 * queueNotification above, so this is the ONLY place that needs to change.
 */
async function sendViaAdapter(
  channel: string,
  recipient: string,
  template: NotificationTemplate,
  payload: Record<string, unknown>
) {
  console.log(`[notification:${channel}] to=${recipient} template=${template}`, payload);
}
