import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFleksClient } from "../../src/modules/intake/fleks/client.js";

describe("FleksClient", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => fetchSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("sends X-API-Key header and returns parsed data", async () => {
    fetchSpy.mockResolvedValue(new Response(
      JSON.stringify({ data: [{ uuid: "j1", functionName: "Test" }], page: 1, limit: 10 }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const client = createFleksClient({ apiKey: "test-key", baseUrl: "https://fleks.test" });
    const res = await client.listJobs({ updatedAtMin: "2026-01-01T00:00:00Z" });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://fleks.test/api/v2/jobs/"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": "test-key" }),
      }),
    );
    expect(res.data).toHaveLength(1);
    expect(res.data[0].uuid).toBe("j1");
  });

  it("retries on 429 with backoff then succeeds", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], page: 1, limit: 10 })));
    const client = createFleksClient({ apiKey: "k", baseUrl: "https://fleks.test", retryDelayMs: 10 });
    const res = await client.listJobs({});
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(res.data).toEqual([]);
  });

  it("throws after 3 consecutive 5xx", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 503 }));
    const client = createFleksClient({ apiKey: "k", baseUrl: "https://fleks.test", retryDelayMs: 1 });
    await expect(client.listJobs({})).rejects.toThrow(/Fleks API error/i);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
