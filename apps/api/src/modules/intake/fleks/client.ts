import type {
  FleksJob, FleksJobCandidate, FleksEmployee, FleksPaginatedResponse,
} from "@recruitment-os/types";

export interface FleksClientConfig {
  apiKey: string;
  baseUrl: string;       // e.g. "https://api.external.fleks.works"
  retryDelayMs?: number; // default 2000
  maxRetries?: number;   // default 3
}

export interface ListJobsParams {
  updatedAtMin?: string;
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

export interface ListJobCandidatesParams {
  jobUUID: string;
  isQualified?: boolean;
  isInvited?: boolean;
  hasActiveContract?: boolean;
  updatedAtMin?: string;
  page?: number;
  limit?: number;
}

export interface FleksClient {
  listJobs(p: ListJobsParams): Promise<FleksPaginatedResponse<FleksJob>>;
  listJobCandidates(p: ListJobCandidatesParams): Promise<FleksPaginatedResponse<FleksJobCandidate>>;
  getEmployee(uuid: string): Promise<FleksEmployee | null>;
  updateEmployee(uuid: string, patch: Record<string, unknown>): Promise<void>;
}

export function createFleksClient(cfg: FleksClientConfig): FleksClient {
  const retryDelayMs = cfg.retryDelayMs ?? 2000;
  const maxRetries = cfg.maxRetries ?? 3;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${cfg.baseUrl}${path}`;
    let lastErr: unknown;
    for (let i = 0; i < maxRetries; i++) {
      const res = await fetch(url, {
        ...init,
        headers: {
          "X-API-Key": cfg.apiKey,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (res.ok) {
        if (res.status === 204) return null as T;
        return (await res.json()) as T;
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Fleks API error ${res.status}`);
        await new Promise((r) => setTimeout(r, retryDelayMs * (i + 1)));
        continue;
      }
      throw new Error(`Fleks API error ${res.status}: ${await res.text()}`);
    }
    throw lastErr ?? new Error("Fleks API error: retries exhausted");
  }

  function qs(params: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((x) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(x))}`));
      else parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? "?" + parts.join("&") : "";
  }

  return {
    listJobs: (p) =>
      request<FleksPaginatedResponse<FleksJob>>(`/api/v2/jobs/${qs(p)}`),
    listJobCandidates: (p) =>
      request<FleksPaginatedResponse<FleksJobCandidate>>(`/api/v2/employees/job-candidates${qs(p)}`),
    getEmployee: async (uuid) => {
      const res = await request<FleksPaginatedResponse<FleksEmployee>>(
        `/api/v2/employees/${qs({ UUIDs: [uuid], limit: 1 })}`,
      );
      return res.data[0] ?? null;
    },
    updateEmployee: async (uuid, patch) => {
      await request<void>(`/api/v2/employees/`, {
        method: "PUT",
        body: JSON.stringify([{ uuid, ...patch }]),
      });
    },
  };
}
