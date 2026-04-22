// Provide a fallback globalThis.fetch so vitest's internal calls don't fail
// when a test uses vi.spyOn(globalThis, "fetch") with mockResolvedValueOnce.
// Vitest 4 makes internal fetch calls after test assertions complete;
// without a fallback the spy returns undefined and Node's URL parser throws.
import { afterEach, vi } from "vitest";

afterEach(() => {
  // If fetch has been spied on, ensure it has a fallback implementation
  // that won't throw on unexpected calls after the test assertions run.
  const fetchMock = (globalThis.fetch as any);
  if (fetchMock?._isMockFunction && !fetchMock.getMockImplementation()) {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
  }
});
