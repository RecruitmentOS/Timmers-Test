import { createHmac } from "node:crypto";
import type { WhatsAppGateway } from "./gateway.js";

export interface TwilioSandboxConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export function createTwilioSandboxGateway(cfg: TwilioSandboxConfig): WhatsAppGateway {
  function stripWhatsAppPrefix(s: string): string {
    return s.startsWith("whatsapp:") ? s.slice("whatsapp:".length) : s;
  }

  return {
    async send({ toPhone, body }) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
      const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");
      const form = new URLSearchParams({
        From: cfg.fromNumber,
        To: `whatsapp:${toPhone}`,
        Body: body,
      });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (!res.ok) throw new Error(`Twilio send failed: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { sid: string; status: string };
      return { messageSid: json.sid, status: (json.status === "queued" ? "queued" : "sent") };
    },

    verifyWebhook(signature, url, params) {
      const sortedKeys = Object.keys(params).sort();
      const data = sortedKeys.reduce((acc, k) => acc + k + params[k], url);
      const expected = createHmac("sha1", cfg.authToken).update(data).digest("base64");
      return signature === expected;
    },

    parseWebhook(params) {
      const mediaCount = parseInt(params.NumMedia ?? "0", 10);
      const mediaUrls: string[] = [];
      for (let i = 0; i < mediaCount; i++) {
        const u = params[`MediaUrl${i}`];
        if (u) mediaUrls.push(u);
      }
      return {
        fromPhone: stripWhatsAppPrefix(params.From ?? ""),
        messageSid: params.MessageSid ?? "",
        body: params.Body ?? "",
        mediaUrls,
      };
    },

    async isWithin24hWindow(_phone, _orgId) {
      return true;
    },
  };
}
