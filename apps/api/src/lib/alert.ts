/**
 * In-app alerting fallback for unhandled errors.
 *
 * When SLACK_WEBHOOK_URL is set, POSTs a Slack-compatible JSON payload
 * ({ text: message }) to that URL. Discord incoming webhooks also accept
 * this shape via the `text` field when using compatibility mode, or the
 * env can point at a Slack-compatible Discord URL (`/slack` suffix).
 *
 * When SLACK_WEBHOOK_URL is unset, logs to console.error and returns.
 * Never throws — a failed alert must not crash the caller (which is
 * typically already handling another error).
 *
 * Satisfies SEC-02: "Alerting on error rate spikes
 * (Sentry + webhook to Slack/Discord)".
 */
export async function sendAlert(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("[alert] SLACK_WEBHOOK_URL not set — alert logged only:", message);
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    if (!res.ok) {
      console.error(
        `[alert] webhook POST failed: ${res.status} ${res.statusText}`,
      );
    }
  } catch (err) {
    console.error("[alert] webhook POST threw — swallowing to avoid cascade:", err);
  }
}
