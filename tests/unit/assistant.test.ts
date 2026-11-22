import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  getDashboardData: vi.fn(),
  buildReminderText: vi.fn(),
  simulateDelay: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    businessProfile: {
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("@/lib/services/dashboard", () => ({
  getDashboardData: mocks.getDashboardData,
}));

vi.mock("@/lib/services/invoices", () => ({
  buildReminderText: mocks.buildReminderText,
}));

vi.mock("@/lib/services/forecast", () => ({
  simulateDelay: mocks.simulateDelay,
}));

import {
  askAssistant,
  getAssistantStatus,
  setAssistantConsent,
} from "@/lib/services/assistant";
import { ServiceError } from "@/lib/services/errors";

const originalGroqKey = process.env.GROQ_API_KEY;
const originalGroqModel = process.env.GROQ_MODEL;

function dashboardFixture() {
  return {
    today: "2026-11-22",
    summary: {
      recordedCashPaise: 1_000_000,
      totalOutstandingPaise: 500_000,
      overduePaise: 100_000,
      overdueInvoiceCount: 1,
      upcomingBillsPaise: 200_000,
      projectedCashPaise: 1_300_000,
    },
    receivables: [
      {
        id: "invoice-1",
        invoiceNumber: "INV-0001",
        outstandingPaise: 500_000,
        dueDate: "2026-11-30",
        overdue: false,
        overdueDays: 0,
        expectedCollectionDate: "2026-11-30",
        customer: { name: "Aurora Brands" },
      },
    ],
    upcomingBills30Days: [
      { title: "Studio rent", dueDate: "2026-11-28", amountPaise: 200_000 },
    ],
    forecast: {
      incomingEvents: [
        { date: "2026-11-25", amountPaise: 300_000 },
        { date: "2026-12-10", amountPaise: 200_000 },
      ],
      minimumCashPaise: 800_000,
      minimumCashDate: "2026-11-28",
      firstShortfallDate: null,
      uncertainInvoices: [],
      assumptions: ["Forecast assumption"],
    },
  };
}

function groqResponse(content: string, status = 200) {
  return new Response(
    JSON.stringify(
      status === 200
        ? { choices: [{ message: { content } }] }
        : { error: { message: "provider detail that must not be exposed" } },
    ),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GROQ_API_KEY = "test-key-never-sent";
  process.env.GROQ_MODEL = "test-model";
  mocks.findUnique.mockResolvedValue({ aiConsentAt: new Date("2026-11-22T00:00:00Z") });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.getDashboardData.mockResolvedValue(dashboardFixture());
  mocks.buildReminderText.mockResolvedValue("Please pay INV-0001.");
  mocks.simulateDelay.mockResolvedValue({
    originalDate: "2026-11-30",
    scenarioDate: "2026-12-15",
    baseline: {
      minimumCashPaise: 800_000,
      firstShortfallDate: null,
      endingCashPaise: 1_300_000,
    },
    scenario: {
      minimumCashPaise: 300_000,
      firstShortfallDate: null,
      endingCashPaise: 1_300_000,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
  if (originalGroqModel === undefined) delete process.env.GROQ_MODEL;
  else process.env.GROQ_MODEL = originalGroqModel;
});

describe("assistant status and consent", () => {
  it("reports business, configuration, consent, and availability independently", async () => {
    expect(await getAssistantStatus()).toEqual({
      businessExists: true,
      configured: true,
      consented: true,
      available: true,
    });

    delete process.env.GROQ_MODEL;
    mocks.findUnique.mockResolvedValueOnce({ aiConsentAt: null });
    expect(await getAssistantStatus()).toEqual({
      businessExists: true,
      configured: false,
      consented: false,
      available: false,
    });
  });

  it("persists consent and rejects consent updates when no business exists", async () => {
    await setAssistantConsent(false);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "local-business" },
      data: { aiConsentAt: null },
    });

    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(setAssistantConsent(true)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("askAssistant", () => {
  it("enforces consent before making a provider request", async () => {
    mocks.findUnique.mockResolvedValueOnce({ aiConsentAt: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(askAssistant("What is my cash position?")).rejects.toMatchObject({
      code: "DOMAIN_RULE",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces configuration before making a provider request", async () => {
    delete process.env.GROQ_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(askAssistant("What is my cash position?")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends current structured facts and bounded history to the configured provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(groqResponse("Cash remains positive."));
    vi.stubGlobal("fetch", fetchMock);

    const result = await askAssistant("What is my cash position?", [
      { role: "user", content: "Earlier question" },
      { role: "assistant", content: "Earlier answer" },
    ]);

    expect(result).toEqual({
      answer: "Cash remains positive.",
      factsUsed: [
        "Current receivables",
        "Upcoming bills",
        "Deterministic 30-day cash forecast",
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("test-model");
    expect(body.messages.at(-1).content).toContain("Structured facts (authoritative)");
    expect(body.messages.at(-1).content).toContain("INV-0001");
    expect(body.messages).toEqual(
      expect.arrayContaining([
        { role: "user", content: "Earlier question" },
        { role: "assistant", content: "Earlier answer" },
      ]),
    );
  });

  it("adds deterministic reminder and delay-scenario facts when requested", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(groqResponse("Scenario reviewed.")));

    const result = await askAssistant(
      "Draft a reminder for INV-0001 and what-if it is 15 days late?",
    );

    expect(mocks.buildReminderText).toHaveBeenCalledWith("invoice-1");
    expect(mocks.simulateDelay).toHaveBeenCalledWith("invoice-1", 15, 30);
    expect(result.factsUsed).toEqual(
      expect.arrayContaining(["Read-only delay simulation", "Deterministic reminder facts"]),
    );
  });

  it("requires an invoice and valid delay for a scenario instead of guessing", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(askAssistant("What-if it is late?")).rejects.toMatchObject({
      code: "DOMAIN_RULE",
    });
  });

  it("returns a safe error for rejected credentials without exposing provider details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(groqResponse("", 401)));

    let error: unknown;
    try {
      await askAssistant("What is my cash position?");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Groq rejected the API key. Check GROQ_API_KEY.",
    });
    expect((error as Error).message).not.toContain("provider detail");
  });
});
