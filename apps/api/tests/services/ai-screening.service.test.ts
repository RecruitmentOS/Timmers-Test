import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockTx, mockWithTenantContext } from "../helpers/test-db.js";
import {
  validCEDriver,
  validCEDriverQualifications,
  noLicenseCandidate,
} from "../fixtures/candidates.js";
import { ceDistributieVacancy } from "../fixtures/vacancies.js";

// Setup mock tx
const mockTx = createMockTx();
const mockWTC = mockWithTenantContext(mockTx);

// Mock withTenantContext
vi.mock("../../src/lib/with-tenant-context.js", () => ({
  withTenantContext: (...args: any[]) => mockWTC(...args),
}));

// Mock db for direct queries (ai_usage quota)
const mockDbExecute = vi.fn();
const mockDbInsert = vi.fn();
const mockDbInsertValues = vi.fn();
const mockDbInsertOnConflict = vi.fn();
const mockDbSelect = vi.fn();
const mockDbSelectFrom = vi.fn();
const mockDbSelectFromWhere = vi.fn();

vi.mock("../../src/db/index.js", () => ({
  db: {
    execute: (...args: any[]) => mockDbExecute(...args),
    insert: (...args: any[]) => {
      mockDbInsert(...args);
      return {
        values: (...vArgs: any[]) => {
          mockDbInsertValues(...vArgs);
          return {
            onConflictDoNothing: (...cArgs: any[]) => {
              mockDbInsertOnConflict(...cArgs);
              return Promise.resolve();
            },
          };
        },
      };
    },
    select: (...args: any[]) => {
      mockDbSelect(...args);
      return {
        from: (...fArgs: any[]) => {
          mockDbSelectFrom(...fArgs);
          return {
            where: (...wArgs: any[]) => {
              return mockDbSelectFromWhere(...wArgs);
            },
          };
        },
      };
    },
  },
}));

// Mock schema modules
vi.mock("../../src/db/schema/ai-screening-logs.js", () => ({
  aiScreeningLogs: {
    id: "id",
    contentHash: "content_hash",
    status: "status",
    applicationId: "application_id",
    verdict: "verdict",
    organizationId: "organization_id",
    vacancyId: "vacancy_id",
    candidateId: "candidate_id",
    createdAt: "created_at",
  },
}));

vi.mock("../../src/db/schema/ai-usage.js", () => ({
  aiUsage: {
    organizationId: "organization_id",
    monthKey: "month_key",
  },
}));

vi.mock("../../src/db/schema/applications.js", () => ({
  candidateApplications: {
    id: "id",
    vacancyId: "vacancy_id",
    candidateId: "candidate_id",
  },
}));

vi.mock("../../src/db/schema/vacancies.js", () => ({
  vacancies: { id: "id" },
}));

vi.mock("../../src/db/schema/candidates.js", () => ({
  candidates: { id: "id" },
}));

vi.mock("../../src/db/schema/driver-qualifications.js", () => ({
  driverQualifications: { candidateId: "candidate_id" },
}));

vi.mock("../../src/lib/errors.js", () => ({
  AppError: class AppError extends Error {
    status: number;
    code?: string;
    constructor(status: number, message: string, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

// Mock drizzle-orm
// sql is used as a tagged template literal: sql`...`, so it must be a function
const sqlTaggedTemplate = (strings: TemplateStringsArray, ...values: any[]) => ({
  _tag: "sql",
  strings,
  values,
});
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ _op: "eq", col, val })),
  and: vi.fn((...args) => ({ _op: "and", args })),
  desc: vi.fn((col) => ({ _op: "desc", col })),
  sql: sqlTaggedTemplate,
}));

// Mock Anthropic — must use a real class so `new Anthropic()` works
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: any) {}
  }
  return { default: MockAnthropic };
});

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
const APP_ID = "app00000-0000-0000-0000-000000000001";

describe("ai-screening.service", () => {
  const originalEnv = { ...process.env };
  let callCount = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.reset();
    callCount = 0;

    // Default: withTenantContext calls alternate between different data needs
    // We'll override per test as needed
    mockDbExecute.mockResolvedValue({ rows: [{ id: 1 }] });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function setupAppLoadMocks() {
    // Each call to withTenantContext will call fn(tx).
    // First call loads app data (select application, vacancy, candidate, quals)
    // We need the tx select chain to return different things on successive calls.
    let selectCallNum = 0;
    mockTx.tx.select.mockImplementation(() => {
      selectCallNum++;
      const chain: any = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            // 1st: application, 2nd: vacancy, 3rd: candidate, 4th: driver quals
            if (selectCallNum === 1) {
              return Promise.resolve([
                {
                  id: APP_ID,
                  vacancyId: ceDistributieVacancy.id,
                  candidateId: validCEDriver.id,
                },
              ]);
            } else if (selectCallNum === 2) {
              return Promise.resolve([ceDistributieVacancy]);
            } else if (selectCallNum === 3) {
              return Promise.resolve([validCEDriver]);
            } else {
              return Promise.resolve(
                validCEDriverQualifications.map((q) => ({
                  ...q,
                  expiresAt: q.expiresAt,
                }))
              );
            }
          }),
          orderBy: vi.fn().mockReturnValue(
            Promise.resolve([])
          ),
        }),
      };
      return chain;
    });
  }

  describe("triggerScreening", () => {
    it("returns yes/maybe/no verdict with reasoning", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      setupAppLoadMocks();

      // No cache hit (second withTenantContext call returns empty)
      let wtcCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        wtcCallNum++;
        if (wtcCallNum === 2) {
          // Cache check - return empty (no cache hit)
          const cacheTx: any = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve([])),
                }),
              }),
            }),
          };
          return fn(cacheTx);
        }
        if (wtcCallNum === 3) {
          // Insert pending log
          const insertTx: any = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockReturnValue(
                  Promise.resolve([{ id: "log-001" }])
                ),
              }),
            }),
          };
          return fn(insertTx);
        }
        if (wtcCallNum === 4) {
          // Update log with result
          const updateTx: any = {
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(Promise.resolve()),
              }),
            }),
          };
          return fn(updateTx);
        }
        return fn(mockTx.tx);
      });

      // Quota check passes
      mockDbExecute.mockResolvedValue({ rows: [{ id: 1 }] });

      // Claude returns valid screening result
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              verdict: "yes",
              reasoning: "Kandidaat heeft CE rijbewijs en code 95, voldoet aan alle eisen.",
              confidence: 0.92,
              matchedCriteria: ["CE rijbewijs", "code 95"],
              missingCriteria: [],
            }),
          },
        ],
        usage: { input_tokens: 500, output_tokens: 200 },
        model: "claude-3-5-haiku-latest",
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.triggerScreening(ORG_ID, APP_ID);

      expect(result.status).toBe("success");
      expect(result.result?.verdict).toBe("yes");
      expect(result.result?.reasoning).toContain("CE rijbewijs");
      expect(result.result?.confidence).toBe(0.92);
      expect(result.cached).toBe(false);
    });

    it("returns cached result on duplicate input (content hash match)", async () => {
      setupAppLoadMocks();

      const cachedLog = {
        id: "log-cached-001",
        contentHash: "abc123",
        status: "success",
        verdict: "maybe",
        reasoning: "Kandidaat heeft ervaring maar code 95 verloopt binnenkort.",
        confidence: "0.65",
        matchedCriteria: ["CE rijbewijs"],
        missingCriteria: ["code 95 bijna verlopen"],
      };

      let wtcCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        wtcCallNum++;
        if (wtcCallNum === 2) {
          // Cache check - return cached hit
          const cacheTx: any = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(
                    Promise.resolve([cachedLog])
                  ),
                }),
              }),
            }),
          };
          return fn(cacheTx);
        }
        return fn(mockTx.tx);
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.triggerScreening(ORG_ID, APP_ID);

      expect(result.cached).toBe(true);
      expect(result.status).toBe("success");
      expect(result.result?.verdict).toBe("maybe");
      expect(result.screeningLogId).toBe("log-cached-001");
      // Should NOT have called Claude
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rejects when tenant exceeds monthly quota", async () => {
      setupAppLoadMocks();

      // No cache hit
      let wtcCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        wtcCallNum++;
        if (wtcCallNum === 2) {
          const cacheTx: any = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve([])),
                }),
              }),
            }),
          };
          return fn(cacheTx);
        }
        return fn(mockTx.tx);
      });

      // Quota exhausted: atomic update returns 0 rows
      mockDbExecute.mockResolvedValue({ rows: [] });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );

      await expect(
        aiScreeningService.triggerScreening(ORG_ID, APP_ID)
      ).rejects.toThrow("AI-limiet bereikt");
    });

    it("returns error status when ANTHROPIC_API_KEY is missing", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      setupAppLoadMocks();

      // No cache hit
      let wtcCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        wtcCallNum++;
        if (wtcCallNum === 2) {
          const cacheTx: any = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve([])),
                }),
              }),
            }),
          };
          return fn(cacheTx);
        }
        if (wtcCallNum === 3) {
          // Insert error log
          const insertTx: any = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockReturnValue(
                  Promise.resolve([
                    { id: "log-error-001", status: "error" },
                  ])
                ),
              }),
            }),
          };
          return fn(insertTx);
        }
        return fn(mockTx.tx);
      });

      // Quota passes
      mockDbExecute.mockResolvedValue({ rows: [{ id: 1 }] });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.triggerScreening(ORG_ID, APP_ID);

      expect(result.status).toBe("error");
      expect(result.cached).toBe(false);
    });

    it("handles Claude API error gracefully (logs error, re-throws)", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      setupAppLoadMocks();

      let wtcCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        wtcCallNum++;
        if (wtcCallNum === 2) {
          const cacheTx: any = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve([])),
                }),
              }),
            }),
          };
          return fn(cacheTx);
        }
        if (wtcCallNum === 3) {
          // Insert pending log
          const insertTx: any = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockReturnValue(
                  Promise.resolve([{ id: "log-error-002" }])
                ),
              }),
            }),
          };
          return fn(insertTx);
        }
        if (wtcCallNum === 4) {
          // Update error log
          const updateTx: any = {
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(Promise.resolve()),
              }),
            }),
          };
          return fn(updateTx);
        }
        return fn(mockTx.tx);
      });

      mockDbExecute.mockResolvedValue({ rows: [{ id: 1 }] });
      mockCreate.mockRejectedValue(new Error("Claude API rate limit exceeded"));

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );

      await expect(
        aiScreeningService.triggerScreening(ORG_ID, APP_ID)
      ).rejects.toThrow("Claude API rate limit exceeded");
    });

    it("uses system prompt separation (system vs user messages)", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      setupAppLoadMocks();

      let wtcCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        wtcCallNum++;
        if (wtcCallNum === 2) {
          const cacheTx: any = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve([])),
                }),
              }),
            }),
          };
          return fn(cacheTx);
        }
        if (wtcCallNum === 3) {
          const insertTx: any = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockReturnValue(
                  Promise.resolve([{ id: "log-sys-001" }])
                ),
              }),
            }),
          };
          return fn(insertTx);
        }
        if (wtcCallNum === 4) {
          const updateTx: any = {
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(Promise.resolve()),
              }),
            }),
          };
          return fn(updateTx);
        }
        return fn(mockTx.tx);
      });

      mockDbExecute.mockResolvedValue({ rows: [{ id: 1 }] });

      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              verdict: "no",
              reasoning: "Test",
              confidence: 0.5,
              matchedCriteria: [],
              missingCriteria: ["alles"],
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: "claude-3-5-haiku-latest",
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      await aiScreeningService.triggerScreening(ORG_ID, APP_ID);

      // Verify Claude was called with system prompt separated from user content
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining("recruitment screening assistant"),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining("vacancy_criteria"),
            }),
          ]),
        })
      );
    });
  });

  describe("getScreeningResult", () => {
    it("returns screening log by ID", async () => {
      const mockLog = {
        id: "log-001",
        status: "success",
        verdict: "yes",
      };

      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        const tx: any = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(
                Promise.resolve([mockLog])
              ),
            }),
          }),
        };
        return fn(tx);
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.getScreeningResult(
        ORG_ID,
        "log-001"
      );

      expect(result).toEqual(mockLog);
    });
  });

  describe("triggerScreening - additional branches", () => {
    it("throws 404 when application not found", async () => {
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        const tx: any = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve([])),
            }),
          }),
        };
        return fn(tx);
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );

      await expect(
        aiScreeningService.triggerScreening(ORG_ID, "non-existent-app")
      ).rejects.toThrow("Application not found");
    });

    it("throws 404 when vacancy not found", async () => {
      let selectCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        selectCallNum = 0;
        const tx: any = {
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockImplementation(() => {
                  if (selectCallNum === 1) {
                    return Promise.resolve([
                      { id: APP_ID, vacancyId: "v-missing", candidateId: "c-1" },
                    ]);
                  }
                  // Vacancy not found
                  return Promise.resolve([]);
                }),
              }),
            };
          }),
        };
        return fn(tx);
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );

      await expect(
        aiScreeningService.triggerScreening(ORG_ID, APP_ID)
      ).rejects.toThrow("Vacancy not found");
    });

    it("throws 404 when candidate not found", async () => {
      let selectCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        selectCallNum = 0;
        const tx: any = {
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockImplementation(() => {
                  if (selectCallNum === 1) {
                    return Promise.resolve([
                      { id: APP_ID, vacancyId: "v-1", candidateId: "c-missing" },
                    ]);
                  }
                  if (selectCallNum === 2) {
                    return Promise.resolve([ceDistributieVacancy]);
                  }
                  // Candidate not found
                  return Promise.resolve([]);
                }),
              }),
            };
          }),
        };
        return fn(tx);
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );

      await expect(
        aiScreeningService.triggerScreening(ORG_ID, APP_ID)
      ).rejects.toThrow("Candidate not found");
    });

    it("handles JSON response wrapped in code blocks", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      setupAppLoadMocks();

      let wtcCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        wtcCallNum++;
        if (wtcCallNum === 2) {
          const cacheTx: any = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve([])),
                }),
              }),
            }),
          };
          return fn(cacheTx);
        }
        if (wtcCallNum === 3) {
          const insertTx: any = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockReturnValue(
                  Promise.resolve([{ id: "log-codeblock" }])
                ),
              }),
            }),
          };
          return fn(insertTx);
        }
        if (wtcCallNum === 4) {
          const updateTx: any = {
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(Promise.resolve()),
              }),
            }),
          };
          return fn(updateTx);
        }
        return fn(mockTx.tx);
      });

      mockDbExecute.mockResolvedValue({ rows: [{ id: 1 }] });

      // Response wrapped in markdown code block
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: '```json\n{"verdict":"no","reasoning":"Geen CE rijbewijs","confidence":0.95,"matchedCriteria":[],"missingCriteria":["CE rijbewijs"]}\n```',
          },
        ],
        usage: { input_tokens: 300, output_tokens: 100 },
        model: "claude-3-5-haiku-latest",
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.triggerScreening(ORG_ID, APP_ID);

      expect(result.status).toBe("success");
      expect(result.result?.verdict).toBe("no");
    });

    it("handles vacancy with null qualificationCriteria and requiredLicenses", async () => {
      // Test the buildScreeningPrompt branches for null criteria
      process.env.ANTHROPIC_API_KEY = "test-key";

      const nullVacancy = {
        ...ceDistributieVacancy,
        qualificationCriteria: null,
        requiredLicenses: null,
      };

      let selectCallNum = 0;
      mockTx.tx.select.mockImplementation(() => {
        selectCallNum++;
        const chain: any = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              if (selectCallNum === 1)
                return Promise.resolve([
                  { id: APP_ID, vacancyId: nullVacancy.id, candidateId: validCEDriver.id },
                ]);
              if (selectCallNum === 2)
                return Promise.resolve([nullVacancy]);
              if (selectCallNum === 3)
                return Promise.resolve([validCEDriver]);
              // No qualifications
              return Promise.resolve([]);
            }),
          }),
        };
        return chain;
      });

      let wtcCallNum = 0;
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        wtcCallNum++;
        if (wtcCallNum === 2) {
          const cacheTx: any = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve([])),
                }),
              }),
            }),
          };
          return fn(cacheTx);
        }
        if (wtcCallNum === 3) {
          const insertTx: any = {
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockReturnValue(
                  Promise.resolve([{ id: "log-null-criteria" }])
                ),
              }),
            }),
          };
          return fn(insertTx);
        }
        if (wtcCallNum === 4) {
          const updateTx: any = {
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(Promise.resolve()),
              }),
            }),
          };
          return fn(updateTx);
        }
        return fn(mockTx.tx);
      });

      mockDbExecute.mockResolvedValue({ rows: [{ id: 1 }] });

      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              verdict: "maybe",
              reasoning: "Geen criteria opgegeven",
              confidence: 0.3,
              matchedCriteria: [],
              missingCriteria: [],
            }),
          },
        ],
        usage: { input_tokens: 200, output_tokens: 80 },
        model: "claude-3-5-haiku-latest",
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.triggerScreening(ORG_ID, APP_ID);

      expect(result.status).toBe("success");
      expect(result.result?.verdict).toBe("maybe");
    });

    it("returns null for non-existent screening log", async () => {
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        const tx: any = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve([])),
            }),
          }),
        };
        return fn(tx);
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.getScreeningResult(
        ORG_ID,
        "non-existent"
      );

      expect(result).toBeNull();
    });

    it("getScreeningHistory returns results ordered by createdAt desc", async () => {
      const logs = [
        { id: "log-2", createdAt: "2026-04-02" },
        { id: "log-1", createdAt: "2026-04-01" },
      ];

      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        const tx: any = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue(Promise.resolve(logs)),
              }),
            }),
          }),
        };
        return fn(tx);
      });

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.getScreeningHistory(
        ORG_ID,
        APP_ID
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("log-2");
    });
  });

  describe("getUsage", () => {
    it("returns defaults when no usage row exists", async () => {
      mockDbSelectFromWhere.mockResolvedValue([]);

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.getUsage(ORG_ID);

      expect(result.screeningCount).toBe(0);
      expect(result.quotaLimit).toBe(500);
    });

    it("returns existing usage data", async () => {
      mockDbSelectFromWhere.mockResolvedValue([
        {
          screeningCount: 42,
          screeningTokens: 15000,
          parseCount: 10,
          parseTokens: 5000,
          quotaLimit: 500,
          monthKey: "2026-04",
        },
      ]);

      const { aiScreeningService } = await import(
        "../../src/services/ai-screening.service.js"
      );
      const result = await aiScreeningService.getUsage(ORG_ID);

      expect(result.screeningCount).toBe(42);
      expect(result.screeningTokens).toBe(15000);
    });
  });
});
