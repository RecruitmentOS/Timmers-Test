import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendAlert } from "../../src/lib/alert.js";

describe("sendAlert", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    errorSpy.mockRestore();
  });

  it("posts { text: message } as JSON to SLACK_WEBHOOK_URL when configured", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/T000/B000/XYZ");
    fetchSpy.mockResolvedValueOnce(
      new Response("ok", { status: 200 }),
    );

    await sendAlert("db is on fire");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://hooks.slack.example/T000/B000/XYZ");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ text: "db is on fire" });
  });

  it("does NOT call fetch and does NOT throw when SLACK_WEBHOOK_URL is unset", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "");

    await expect(sendAlert("quiet failure")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled(); // console.error used for log-only path
  });

  it("swallows a fetch rejection so the caller's error handler never cascades", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/T000/B000/XYZ");
    fetchSpy.mockRejectedValueOnce(new Error("network down"));

    await expect(sendAlert("boom")).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("logs but does not throw when webhook returns non-2xx", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/T000/B000/XYZ");
    fetchSpy.mockResolvedValueOnce(
      new Response("bad", { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(sendAlert("server err")).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
