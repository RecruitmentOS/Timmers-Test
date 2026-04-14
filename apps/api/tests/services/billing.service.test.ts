import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createBillingFixture,
  agencyBilling,
  employerBilling,
} from "../fixtures/organizations.js";

// Mock the db module
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

const selectChain: any = {
  from: mockFrom,
};
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue([]);

const insertChain: any = {
  values: mockValues,
};
mockValues.mockReturnValue(Promise.resolve());

const updateChain: any = {
  set: mockSet,
};
mockSet.mockReturnValue({ where: vi.fn().mockReturnValue(Promise.resolve()) });

vi.mock("../../src/db/index.js", () => ({
  db: {
    select: () => selectChain,
    insert: () => insertChain,
    update: () => updateChain,
  },
}));

// Mock the billing schema
vi.mock("../../src/db/schema/billing.js", () => ({
  tenantBilling: {
    organizationId: "organization_id",
    stripeCustomerId: "stripe_customer_id",
  },
  PLAN_LIMITS: {
    starter: {
      maxUsers: 3,
      maxActiveVacancies: 5,
      maxPlacements: Infinity,
    },
    growth: {
      maxUsers: 10,
      maxActiveVacancies: 25,
      maxPlacements: Infinity,
    },
    enterprise: {
      maxUsers: Infinity,
      maxActiveVacancies: Infinity,
      maxPlacements: Infinity,
    },
  },
}));

// Mock drizzle-orm eq
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

// Mock stripe — must be a real class so `new Stripe()` works
vi.mock("stripe", () => {
  class MockStripe {
    customers = {
      create: vi.fn().mockResolvedValue({ id: "cus_test123" }),
    };
    subscriptions = {
      create: vi
        .fn()
        .mockResolvedValue({ id: "sub_test123", status: "trialing" }),
    };
    billingPortal = {
      sessions: {
        create: vi
          .fn()
          .mockResolvedValue({ url: "https://billing.stripe.com/session/test" }),
      },
    };
    constructor(_key?: string, _opts?: any) {}
  }
  return { default: MockStripe };
});

describe("billing.service", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset select chain
    mockWhere.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("isStripeEnabled", () => {
    it("returns false when STRIPE_SECRET_KEY is unset", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      // Re-import to get fresh module
      const { isStripeEnabled } = await import(
        "../../src/services/billing.service.js"
      );
      expect(isStripeEnabled()).toBe(false);
    });

    it("returns true when STRIPE_SECRET_KEY is set", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { isStripeEnabled } = await import(
        "../../src/services/billing.service.js"
      );
      expect(isStripeEnabled()).toBe(true);
    });
  });

  describe("getStripe", () => {
    it("returns null when dormant (no STRIPE_SECRET_KEY)", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { getStripe } = await import(
        "../../src/services/billing.service.js"
      );
      expect(getStripe()).toBeNull();
    });
  });

  describe("billingService.getUsageSummary", () => {
    it("returns correct counts for users, active vacancies, placements", async () => {
      const billing = createBillingFixture({
        planTier: "growth",
        currentActiveUsers: 5,
        currentActiveVacancies: 12,
        currentPlacements: 3,
      });

      mockWhere.mockResolvedValue([billing]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );
      const result = await billingService.getUsageSummary("org-id");

      expect(result.activeUsers).toBe(5);
      expect(result.activeVacancies).toBe(12);
      expect(result.placements).toBe(3);
      expect(result.planTier).toBe("growth");
    });

    it("returns starter limits when no billing record exists", async () => {
      mockWhere.mockResolvedValue([]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );
      const result = await billingService.getUsageSummary("unknown-org");

      expect(result.activeUsers).toBe(0);
      expect(result.activeVacancies).toBe(0);
      expect(result.placements).toBe(0);
      expect(result.planTier).toBe("starter");
      expect(result.limits.maxUsers).toBe(3);
      expect(result.limits.maxActiveVacancies).toBe(5);
    });

    it("returns correct plan tier limits for growth plan", async () => {
      const billing = createBillingFixture({ planTier: "growth" });
      mockWhere.mockResolvedValue([billing]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );
      const result = await billingService.getUsageSummary("org-id");

      expect(result.limits.maxUsers).toBe(10);
      expect(result.limits.maxActiveVacancies).toBe(25);
    });
  });

  describe("billingService.getBillingDashboard", () => {
    it("returns trial info for trialing org", async () => {
      const billing = createBillingFixture({
        status: "trialing",
        trialEndsAt: new Date("2026-02-15"),
        stripeCustomerId: null,
      });
      mockWhere.mockResolvedValue([billing]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );
      const result = await billingService.getBillingDashboard("org-id");

      expect(result.status).toBe("trialing");
      expect(result.trialEndsAt).toBe("2026-02-15T00:00:00.000Z");
      expect(result.portalUrl).toBeNull();
    });

    it("returns portal URL available when stripe customer exists", async () => {
      const billing = createBillingFixture({
        status: "active",
        stripeCustomerId: "cus_test123",
      });
      mockWhere.mockResolvedValue([billing]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );
      const result = await billingService.getBillingDashboard("org-id");

      expect(result.portalUrl).toBe("available");
    });

    it("returns incomplete status when no billing record", async () => {
      mockWhere.mockResolvedValue([]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );
      const result = await billingService.getBillingDashboard("org-id");

      expect(result.status).toBe("incomplete");
      expect(result.trialEndsAt).toBeNull();
    });
  });

  describe("billingService.createCustomerAndSubscription", () => {
    it("creates local billing record in dormant mode (no Stripe key)", async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.createCustomerAndSubscription(
        "org-123",
        "Test BV",
        "test@example.com",
        "starter"
      );

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-123",
          stripeCustomerId: null,
          subscriptionId: null,
          planTier: "starter",
          status: "trialing",
        })
      );
    });
  });

  describe("billingService.handleWebhookEvent", () => {
    it("updates status on subscription.updated event", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "active",
            metadata: { orgId: "org-123" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active" })
      );
    });

    it("sets canceled status on subscription.deleted event", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.deleted",
        data: {
          object: {
            metadata: { orgId: "org-123" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "canceled" })
      );
    });

    it("sets past_due on invoice.payment_failed event", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_test_fail",
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "past_due" })
      );
    });

    it("does not throw on invoice.payment_succeeded", async () => {
      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await expect(
        billingService.handleWebhookEvent({
          type: "invoice.payment_succeeded",
          data: {
            object: { id: "inv_test123" },
          },
        } as any)
      ).resolves.toBeUndefined();
    });

    it("skips subscription.updated when orgId is missing from metadata", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "active",
            metadata: {},
          },
        },
      } as any);

      // Should not have called update since orgId was missing
      expect(mockSetWhere).not.toHaveBeenCalled();
    });

    it("skips subscription.deleted when orgId is missing", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.deleted",
        data: {
          object: { metadata: {} },
        },
      } as any);

      expect(mockSetWhere).not.toHaveBeenCalled();
    });

    it("handles invoice.payment_failed with customer as object", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: { id: "cus_obj_123" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "past_due" })
      );
    });

    it("skips invoice.payment_failed when customer is null", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "invoice.payment_failed",
        data: {
          object: { customer: null },
        },
      } as any);

      expect(mockSetWhere).not.toHaveBeenCalled();
    });

    it("handles unknown event types gracefully", async () => {
      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await expect(
        billingService.handleWebhookEvent({
          type: "checkout.session.completed",
          data: { object: {} },
        } as any)
      ).resolves.toBeUndefined();
    });

    it("maps 'trialing' stripe status correctly", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "trialing",
            metadata: { orgId: "org-map-1" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "trialing" })
      );
    });

    it("maps 'past_due' stripe status correctly", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "past_due",
            metadata: { orgId: "org-map-2" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "past_due" })
      );
    });

    it("maps 'unpaid' stripe status to canceled", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "unpaid",
            metadata: { orgId: "org-map-3" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "canceled" })
      );
    });

    it("maps 'incomplete' stripe status correctly", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "incomplete",
            metadata: { orgId: "org-map-4" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "incomplete" })
      );
    });

    it("maps 'incomplete_expired' stripe status to incomplete", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "incomplete_expired",
            metadata: { orgId: "org-map-5" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "incomplete" })
      );
    });

    it("maps unknown stripe status to active (default)", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockSetWhere });

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      await billingService.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            status: "some_future_status",
            metadata: { orgId: "org-map-6" },
          },
        },
      } as any);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active" })
      );
    });
  });

  describe("billingService.createPortalSession", () => {
    it("returns null when dormant (no Stripe key)", async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      const result = await billingService.createPortalSession(
        "org-123",
        "https://app.recruitment-os.nl/billing"
      );

      expect(result).toBeNull();
    });

    it("returns null when no billing record found", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_portal";
      mockWhere.mockResolvedValue([]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      const result = await billingService.createPortalSession(
        "org-no-billing",
        "https://app.recruitment-os.nl/billing"
      );

      expect(result).toBeNull();
    });

    it("returns null when billing record has no stripeCustomerId", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_portal2";
      mockWhere.mockResolvedValue([
        createBillingFixture({ stripeCustomerId: null }),
      ]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      const result = await billingService.createPortalSession(
        "org-no-stripe",
        "https://app.recruitment-os.nl/billing"
      );

      expect(result).toBeNull();
    });
  });

  describe("billingService.getTenantBilling", () => {
    it("returns null when no billing record exists", async () => {
      mockWhere.mockResolvedValue([]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      const result = await billingService.getTenantBilling("non-existent-org");
      expect(result).toBeNull();
    });

    it("returns billing record when found", async () => {
      const billing = createBillingFixture();
      mockWhere.mockResolvedValue([billing]);

      const { billingService } = await import(
        "../../src/services/billing.service.js"
      );

      const result = await billingService.getTenantBilling("org-id");
      expect(result).toEqual(billing);
    });
  });
});
