// apps/api/src/modules/intake/pushback.service.ts
import type { FleksClient } from "./fleks/client.js";

export async function pushVerdictToFleks(
  client: FleksClient,
  fleksEmployeeUuid: string,
  verdict: "qualified" | "rejected" | "unsure",
): Promise<void> {
  await client.updateEmployee(fleksEmployeeUuid, {
    additionalFields: { recruitment_os_status: verdict },
  });
}
