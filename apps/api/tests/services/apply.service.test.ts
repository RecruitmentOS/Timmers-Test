import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockTx, mockWithTenantContext } from "../helpers/test-db.js";
import { createCandidateFixture, validCEDriver } from "../fixtures/candidates.js";
import { ceDistributieVacancy } from "../fixtures/vacancies.js";

// Setup mock tx
const mockTx = createMockTx();
const mockWTC = mockWithTenantContext(mockTx);

// Mock withTenantContext
vi.mock("../../src/lib/with-tenant-context.js", () => ({
  withTenantContext: (...args: any[]) => mockWTC(...args),
}));

// Mock schema modules (need table references for eq())
vi.mock("../../src/db/schema/index.js", () => ({
  candidates: { id: "id", organizationId: "organization_id", email: "email" },
  candidateApplications: {
    id: "id",
    organizationId: "organization_id",
    candidateId: "candidate_id",
    campaignId: "campaign_id",
  },
  campaigns: {
    id: "id",
    organizationId: "organization_id",
    name: "name",
  },
  pipelineStages: {
    id: "id",
    organizationId: "organization_id",
    isDefault: "is_default",
    name: "name",
  },
  fileMetadata: { id: "id" },
  activityLog: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ _op: "eq", col, val })),
  and: vi.fn((...args) => ({ _op: "and", args })),
  or: vi.fn((...args) => ({ _op: "or", args })),
}));

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
const VACANCY_ID = ceDistributieVacancy.id;
const OWNER_ID = "u0000000-0000-0000-0000-000000000001";
const DEFAULT_STAGE_ID = "stage-new-001";

describe("apply.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default behavior for the tx chain inside withTenantContext
    // The apply service makes multiple insert/select calls within one withTenantContext call
    let selectCallNum = 0;
    let insertCallNum = 0;

    mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
      selectCallNum = 0;
      insertCallNum = 0;

      const tx: any = {
        insert: vi.fn().mockImplementation(() => {
          insertCallNum++;
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockImplementation(() => {
                if (insertCallNum === 1) {
                  // Insert candidate
                  return Promise.resolve([
                    {
                      id: "cand-new-001",
                      organizationId: ORG_ID,
                      firstName: "Test",
                      lastName: "User",
                    },
                  ]);
                }
                if (insertCallNum === 2) {
                  // Insert application
                  return Promise.resolve([
                    {
                      id: "app-new-001",
                      candidateId: "cand-new-001",
                      vacancyId: VACANCY_ID,
                    },
                  ]);
                }
                return Promise.resolve([{ id: "misc-001" }]);
              }),
            }),
          };
        }),
        select: vi.fn().mockImplementation(() => {
          selectCallNum++;
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockImplementation(() => {
                if (selectCallNum === 1) {
                  // First select: default pipeline stage
                  return Promise.resolve([{ id: DEFAULT_STAGE_ID }]);
                }
                if (selectCallNum === 2) {
                  // Fallback stage lookup
                  return Promise.resolve([]);
                }
                // Campaign lookup
                return Promise.resolve([]);
              }),
            }),
          };
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(Promise.resolve()),
          }),
        }),
      };

      return fn(tx);
    });
  });

  describe("submitApplication", () => {
    it("creates candidate + application in single transaction", async () => {
      const { applyService } = await import(
        "../../src/services/apply.service.js"
      );

      const result = await applyService.submitApplication(
        ORG_ID,
        VACANCY_ID,
        {
          firstName: "Jan",
          lastName: "de Vries",
          email: "jan.devries@gmail.com",
          phone: "+31612345678",
          city: "Rotterdam",
        },
        OWNER_ID
      );

      expect(result.candidateId).toBe("cand-new-001");
      expect(result.applicationId).toBe("app-new-001");
    });

    it("stores UTM source/medium/campaign on application record", async () => {
      let capturedAppValues: any = null;

      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        let insertCallNum = 0;
        let selectCallNum = 0;

        const tx: any = {
          insert: vi.fn().mockImplementation(() => {
            insertCallNum++;
            return {
              values: vi.fn().mockImplementation((vals: any) => {
                if (insertCallNum === 2) capturedAppValues = vals;
                return {
                  returning: vi.fn().mockImplementation(() => {
                    if (insertCallNum === 1) {
                      return Promise.resolve([{ id: "cand-utm-001" }]);
                    }
                    if (insertCallNum === 2) {
                      return Promise.resolve([
                        { id: "app-utm-001", candidateId: "cand-utm-001" },
                      ]);
                    }
                    return Promise.resolve([{ id: "misc" }]);
                  }),
                };
              }),
            };
          }),
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(
                  selectCallNum === 1
                    ? Promise.resolve([{ id: DEFAULT_STAGE_ID }])
                    : Promise.resolve([])
                ),
              }),
            };
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve()),
            }),
          }),
        };

        return fn(tx);
      });

      const { applyService } = await import(
        "../../src/services/apply.service.js"
      );

      await applyService.submitApplication(
        ORG_ID,
        VACANCY_ID,
        {
          firstName: "Pieter",
          lastName: "Bakker",
          email: "p.bakker@hotmail.nl",
          phone: "+31687654321",
          utmSource: "indeed",
          utmMedium: "cpc",
          utmCampaign: "ce-chauffeur-q1",
        },
        OWNER_ID
      );

      expect(capturedAppValues).toBeDefined();
      expect(capturedAppValues.utmSource).toBe("indeed");
      expect(capturedAppValues.utmMedium).toBe("cpc");
      expect(capturedAppValues.utmCampaign).toBe("ce-chauffeur-q1");
    });

    it("links UTM campaign to matching campaign record", async () => {
      let updateSetCalled = false;
      let updateSetValues: any = null;

      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        let insertCallNum = 0;
        let selectCallNum = 0;

        const tx: any = {
          insert: vi.fn().mockImplementation(() => {
            insertCallNum++;
            return {
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockImplementation(() => {
                  if (insertCallNum === 1)
                    return Promise.resolve([{ id: "cand-camp-001" }]);
                  if (insertCallNum === 2)
                    return Promise.resolve([
                      { id: "app-camp-001", candidateId: "cand-camp-001" },
                    ]);
                  return Promise.resolve([{ id: "misc" }]);
                }),
              }),
            };
          }),
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockImplementation(() => {
                  if (selectCallNum === 1)
                    return Promise.resolve([{ id: DEFAULT_STAGE_ID }]);
                  if (selectCallNum === 2) {
                    // Campaign lookup matches
                    return Promise.resolve([{ id: "campaign-001" }]);
                  }
                  return Promise.resolve([]);
                }),
              }),
            };
          }),
          update: vi.fn().mockImplementation(() => ({
            set: vi.fn().mockImplementation((vals: any) => {
              updateSetCalled = true;
              updateSetValues = vals;
              return {
                where: vi.fn().mockReturnValue(Promise.resolve()),
              };
            }),
          })),
        };

        return fn(tx);
      });

      const { applyService } = await import(
        "../../src/services/apply.service.js"
      );

      await applyService.submitApplication(
        ORG_ID,
        VACANCY_ID,
        {
          firstName: "Mohammed",
          lastName: "El Amrani",
          email: "m.elamrani@outlook.com",
          phone: "+31620001234",
          utmCampaign: "ce-chauffeur-q1",
        },
        OWNER_ID
      );

      expect(updateSetCalled).toBe(true);
      expect(updateSetValues.campaignId).toBe("campaign-001");
    });

    it("creates application with stage 'New' (default stage)", async () => {
      let capturedAppValues: any = null;

      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        let insertCallNum = 0;
        let selectCallNum = 0;

        const tx: any = {
          insert: vi.fn().mockImplementation(() => {
            insertCallNum++;
            return {
              values: vi.fn().mockImplementation((vals: any) => {
                if (insertCallNum === 2) capturedAppValues = vals;
                return {
                  returning: vi.fn().mockImplementation(() => {
                    if (insertCallNum === 1)
                      return Promise.resolve([{ id: "cand-stage-001" }]);
                    if (insertCallNum === 2)
                      return Promise.resolve([
                        { id: "app-stage-001", candidateId: "cand-stage-001" },
                      ]);
                    return Promise.resolve([{ id: "misc" }]);
                  }),
                };
              }),
            };
          }),
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockImplementation(() => {
                  if (selectCallNum === 1) {
                    // Default stage found
                    return Promise.resolve([{ id: "stage-new-default" }]);
                  }
                  return Promise.resolve([]);
                }),
              }),
            };
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve()),
            }),
          }),
        };

        return fn(tx);
      });

      const { applyService } = await import(
        "../../src/services/apply.service.js"
      );

      await applyService.submitApplication(
        ORG_ID,
        VACANCY_ID,
        {
          firstName: "Sophie",
          lastName: "Jansen",
          email: "sophie@test.nl",
          phone: "+31698765432",
        },
        OWNER_ID
      );

      expect(capturedAppValues).toBeDefined();
      expect(capturedAppValues.currentStageId).toBe("stage-new-default");
      expect(capturedAppValues.qualificationStatus).toBe("pending");
    });

    it("falls back to stage named 'New' when no default stage exists", async () => {
      let capturedAppValues: any = null;

      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        let insertCallNum = 0;
        let selectCallNum = 0;

        const tx: any = {
          insert: vi.fn().mockImplementation(() => {
            insertCallNum++;
            return {
              values: vi.fn().mockImplementation((vals: any) => {
                if (insertCallNum === 2) capturedAppValues = vals;
                return {
                  returning: vi.fn().mockImplementation(() => {
                    if (insertCallNum === 1)
                      return Promise.resolve([{ id: "cand-fb-001" }]);
                    if (insertCallNum === 2)
                      return Promise.resolve([
                        { id: "app-fb-001", candidateId: "cand-fb-001" },
                      ]);
                    return Promise.resolve([{ id: "misc" }]);
                  }),
                };
              }),
            };
          }),
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockImplementation(() => {
                  if (selectCallNum === 1) {
                    // No default stage
                    return Promise.resolve([]);
                  }
                  if (selectCallNum === 2) {
                    // Fallback: stage named "New"
                    return Promise.resolve([{ id: "stage-named-new" }]);
                  }
                  return Promise.resolve([]);
                }),
              }),
            };
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve()),
            }),
          }),
        };

        return fn(tx);
      });

      const { applyService } = await import(
        "../../src/services/apply.service.js"
      );

      await applyService.submitApplication(
        ORG_ID,
        VACANCY_ID,
        {
          firstName: "Test",
          lastName: "Fallback",
          email: "test.fallback@test.nl",
          phone: "+31600000000",
        },
        OWNER_ID
      );

      expect(capturedAppValues).toBeDefined();
      expect(capturedAppValues.currentStageId).toBe("stage-named-new");
    });

    it("sets source to 'direct' when utmSource is not provided", async () => {
      let capturedCandidateValues: any = null;

      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        let insertCallNum = 0;
        let selectCallNum = 0;

        const tx: any = {
          insert: vi.fn().mockImplementation(() => {
            insertCallNum++;
            return {
              values: vi.fn().mockImplementation((vals: any) => {
                if (insertCallNum === 1) capturedCandidateValues = vals;
                return {
                  returning: vi.fn().mockImplementation(() => {
                    if (insertCallNum === 1)
                      return Promise.resolve([{ id: "cand-src-001" }]);
                    if (insertCallNum === 2)
                      return Promise.resolve([
                        { id: "app-src-001", candidateId: "cand-src-001" },
                      ]);
                    return Promise.resolve([{ id: "misc" }]);
                  }),
                };
              }),
            };
          }),
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(
                  selectCallNum === 1
                    ? Promise.resolve([{ id: DEFAULT_STAGE_ID }])
                    : Promise.resolve([])
                ),
              }),
            };
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve()),
            }),
          }),
        };

        return fn(tx);
      });

      const { applyService } = await import(
        "../../src/services/apply.service.js"
      );

      await applyService.submitApplication(
        ORG_ID,
        VACANCY_ID,
        {
          firstName: "Direct",
          lastName: "Apply",
          email: "direct@test.nl",
          phone: "+31600000001",
        },
        OWNER_ID
      );

      expect(capturedCandidateValues.source).toBe("direct");
    });

    it("links CV file when cvFileId is provided", async () => {
      let fileInsertCalled = false;
      let fileInsertValues: any = null;

      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        let insertCallNum = 0;
        let selectCallNum = 0;

        const tx: any = {
          insert: vi.fn().mockImplementation(() => {
            insertCallNum++;
            return {
              values: vi.fn().mockImplementation((vals: any) => {
                if (insertCallNum === 3) {
                  // fileMetadata insert
                  fileInsertCalled = true;
                  fileInsertValues = vals;
                }
                return {
                  returning: vi.fn().mockImplementation(() => {
                    if (insertCallNum === 1)
                      return Promise.resolve([{ id: "cand-cv-001" }]);
                    if (insertCallNum === 2)
                      return Promise.resolve([
                        { id: "app-cv-001", candidateId: "cand-cv-001" },
                      ]);
                    return Promise.resolve([{ id: "file-001" }]);
                  }),
                };
              }),
            };
          }),
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(
                  selectCallNum === 1
                    ? Promise.resolve([{ id: DEFAULT_STAGE_ID }])
                    : Promise.resolve([])
                ),
              }),
            };
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve()),
            }),
          }),
        };

        return fn(tx);
      });

      const { applyService } = await import(
        "../../src/services/apply.service.js"
      );

      await applyService.submitApplication(
        ORG_ID,
        VACANCY_ID,
        {
          firstName: "Jan",
          lastName: "CV",
          email: "jan.cv@test.nl",
          phone: "+31612340000",
          cvFileId: "tenants/org-001/candidates/cv-jan.pdf",
        },
        OWNER_ID
      );

      expect(fileInsertCalled).toBe(true);
      expect(fileInsertValues.s3Key).toBe(
        "tenants/org-001/candidates/cv-jan.pdf"
      );
      expect(fileInsertValues.filename).toBe("cv-jan.pdf");
    });

    it("continues gracefully when UTM campaign linking fails", async () => {
      mockWTC.mockImplementation(async (_orgId: string, fn: any) => {
        let insertCallNum = 0;
        let selectCallNum = 0;

        const tx: any = {
          insert: vi.fn().mockImplementation(() => {
            insertCallNum++;
            return {
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockImplementation(() => {
                  if (insertCallNum === 1)
                    return Promise.resolve([{ id: "cand-fail-001" }]);
                  if (insertCallNum === 2)
                    return Promise.resolve([
                      {
                        id: "app-fail-001",
                        candidateId: "cand-fail-001",
                      },
                    ]);
                  return Promise.resolve([{ id: "misc" }]);
                }),
              }),
            };
          }),
          select: vi.fn().mockImplementation(() => {
            selectCallNum++;
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockImplementation(() => {
                  if (selectCallNum === 1)
                    return Promise.resolve([{ id: DEFAULT_STAGE_ID }]);
                  if (selectCallNum === 2) {
                    // Campaign lookup throws
                    throw new Error("DB connection error");
                  }
                  return Promise.resolve([]);
                }),
              }),
            };
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve()),
            }),
          }),
        };

        return fn(tx);
      });

      const { applyService } = await import(
        "../../src/services/apply.service.js"
      );

      // Should NOT throw despite campaign linking failure
      const result = await applyService.submitApplication(
        ORG_ID,
        VACANCY_ID,
        {
          firstName: "Error",
          lastName: "Test",
          email: "error@test.nl",
          phone: "+31600000002",
          utmCampaign: "broken-campaign",
        },
        OWNER_ID
      );

      expect(result.candidateId).toBe("cand-fail-001");
      expect(result.applicationId).toBe("app-fail-001");
    });
  });
});
