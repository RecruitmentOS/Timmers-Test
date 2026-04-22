import { describe, it, expect, vi } from "vitest";
import { createTwilioSandboxGateway } from "../../src/modules/intake/whatsapp/twilio-sandbox.js";

describe("TwilioSandboxGateway", () => {
  it("parses inbound webhook params", () => {
    const gw = createTwilioSandboxGateway({
      accountSid: "AC...", authToken: "tok", fromNumber: "whatsapp:+14155238886",
    });
    const parsed = gw.parseWebhook({
      From: "whatsapp:+31600000001",
      MessageSid: "SM123",
      Body: "hoi",
      NumMedia: "0",
    });
    expect(parsed).toEqual({
      fromPhone: "+31600000001",
      messageSid: "SM123",
      body: "hoi",
      mediaUrls: [],
    });
  });

  it("sends outbound via Twilio API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sid: "SM999", status: "queued" }), { status: 201 })
    );
    const gw = createTwilioSandboxGateway({
      accountSid: "AC123", authToken: "tok", fromNumber: "whatsapp:+14155238886",
    });
    const res = await gw.send({ toPhone: "+31600000001", body: "hello" });
    expect(res.messageSid).toBe("SM999");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
      expect.objectContaining({ method: "POST" }),
    );
    fetchSpy.mockRestore();
  });
});
