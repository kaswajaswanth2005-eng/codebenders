import { describe, it, expect } from "vitest";
import { computeForecast, type ForecastInput } from "../../src/lib/financial/forecast";

// Canonical Day-10 scenario: today 2026-11-01, 30-day horizon (ends 2026-12-01).
function canonicalInput(): ForecastInput {
  return {
    today: "2026-11-01",
    horizonDays: 30,
    opening: { cashPaise: 2000000, asOfDate: "2026-10-31" },
    invoices: [
      {
        id: "inv-a",
        customerName: "Client A",
        invoiceNumber: "INV-A",
        lifecycle: "ISSUED",
        dueDate: "2026-11-30",
        expectedCollectionDate: "2026-11-06",
        totalPaise: 4000000,
        payments: [],
      },
      {
        id: "inv-b",
        customerName: "Client B",
        invoiceNumber: "INV-B",
        lifecycle: "ISSUED",
        dueDate: "2026-11-30",
        expectedCollectionDate: "2026-11-16",
        totalPaise: 2500000,
        payments: [],
      },
    ],
    bills: [
      { billId: "bill-rent", title: "Rent", dueDate: "2026-11-11", amountPaise: 3000000, paidDate: null },
      { billId: "bill-salaries", title: "Salaries", dueDate: "2026-11-21", amountPaise: 4500000, paidDate: null },
    ],
  };
}

describe("computeForecast - canonical Day-10 scenario", () => {
  it("produces the baseline closings at offsets 0, 5, 10, 15, 20", () => {
    const result = computeForecast(canonicalInput());
    expect(result.points).toHaveLength(31);
    const offsets = [0, 5, 10, 15, 20];
    expect(offsets.map((o) => result.points[o].closingCashPaise)).toEqual([
      2000000, 6000000, 3000000, 5500000, 1000000,
    ]);
    expect(result.endingCashPaise).toBe(1000000);
    expect(result.negativeDays).toBe(0);
    expect(result.firstShortfallDate).toBeNull();
  });

  it("shifting Client A by 15 days produces the shortfall scenario", () => {
    const input = canonicalInput();
    input.shift = { invoiceId: "inv-a", delayDays: 15 };
    const result = computeForecast(input);
    const offsets = [0, 5, 10, 15, 20];
    expect(offsets.map((o) => result.points[o].closingCashPaise)).toEqual([
      2000000, 2000000, -1000000, 1500000, 1000000,
    ]);
    expect(result.firstShortfallDate).toBe("2026-11-11");
    expect(result.minimumCashPaise).toBe(-1000000);
    expect(result.minimumCashDate).toBe("2026-11-11");
    // Offsets 10 through 14 (2026-11-11 .. 2026-11-15) are negative: exactly 5 days.
    expect(result.negativeDays).toBe(5);
  });

  it("shifted Client A inflow lands on 2026-11-21 with SHIFTED_SCENARIO basis", () => {
    const input = canonicalInput();
    input.shift = { invoiceId: "inv-a", delayDays: 15 };
    const result = computeForecast(input);
    const shifted = result.incomingEvents.find((e) => e.invoiceId === "inv-a");
    expect(shifted).toBeDefined();
    expect(shifted?.date).toBe("2026-11-21");
    expect(shifted?.basis).toBe("SHIFTED_SCENARIO");
    expect(shifted?.amountPaise).toBe(4000000);
  });

  it("a 30-day shift drops Client A out of the horizon and reduces ending cash by 4000000", () => {
    const baseline = computeForecast(canonicalInput());
    const input = canonicalInput();
    input.shift = { invoiceId: "inv-a", delayDays: 30 }; // lands 2026-12-06, beyond 2026-12-01
    const result = computeForecast(input);
    expect(result.incomingEvents.some((e) => e.invoiceId === "inv-a")).toBe(false);
    expect(result.endingCashPaise).toBe(baseline.endingCashPaise - 4000000);
    expect(result.endingCashPaise).toBe(-3000000);
  });
});

describe("computeForecast - recorded cash", () => {
  it("excludes a payment dated exactly on the snapshot date", () => {
    const input = canonicalInput();
    input.invoices[0].payments = [{ paymentDate: "2026-10-31", amountPaise: 100000 }];
    const result = computeForecast(input);
    expect(result.recordedCashPaise).toBe(2000000);
  });

  it("excludes payments dated before the snapshot", () => {
    const input = canonicalInput();
    input.invoices[0].payments = [{ paymentDate: "2026-10-15", amountPaise: 200000 }];
    const result = computeForecast(input);
    expect(result.recordedCashPaise).toBe(2000000);
  });

  it("includes a payment dated on today (2026-11-01)", () => {
    const input = canonicalInput();
    input.invoices[0].payments = [{ paymentDate: "2026-11-01", amountPaise: 300000 }];
    const result = computeForecast(input);
    expect(result.recordedCashPaise).toBe(2300000);
  });

  it("a paid bill with paidDate after the snapshot reduces recorded cash and is not an outflow", () => {
    const input = canonicalInput();
    input.bills[0].paidDate = "2026-11-01";
    const result = computeForecast(input);
    expect(result.recordedCashPaise).toBe(2000000 - 3000000);
    expect(result.outgoingEvents.some((e) => e.billId === "bill-rent")).toBe(false);
  });
});

describe("computeForecast - uncertain and overdue items", () => {
  it("an overdue invoice with no expected date goes to uncertainInvoices, not incomingEvents", () => {
    const input = canonicalInput();
    input.invoices = [
      {
        id: "inv-old",
        customerName: "Late Client",
        invoiceNumber: "INV-OLD",
        lifecycle: "ISSUED",
        dueDate: "2026-10-20",
        expectedCollectionDate: null,
        totalPaise: 500000,
        payments: [],
      },
    ];
    input.bills = [];
    const result = computeForecast(input);
    expect(result.uncertainInvoices).toEqual([
      { invoiceId: "inv-old", invoiceNumber: "INV-OLD", customerName: "Late Client", outstandingPaise: 500000 },
    ]);
    expect(result.incomingEvents.some((e) => e.invoiceId === "inv-old")).toBe(false);
  });

  it("a stale expectedCollectionDate with a future dueDate goes to uncertainInvoices, not dated", () => {
    const input = canonicalInput();
    input.invoices = [
      {
        id: "inv-stale",
        customerName: "Stale Client",
        invoiceNumber: "INV-STALE",
        lifecycle: "ISSUED",
        dueDate: "2026-11-30",
        expectedCollectionDate: "2026-10-25",
        totalPaise: 700000,
        payments: [],
      },
    ];
    input.bills = [];
    const result = computeForecast(input);
    expect(result.uncertainInvoices.map((u) => u.invoiceId)).toEqual(["inv-stale"]);
    expect(result.incomingEvents).toHaveLength(0);
  });

  it("an overdue unpaid bill goes to overdueBills, not outgoingEvents", () => {
    const input = canonicalInput();
    input.bills = [{ billId: "bill-old", title: "Old power bill", dueDate: "2026-10-25", amountPaise: 80000, paidDate: null }];
    const result = computeForecast(input);
    expect(result.overdueBills).toEqual([
      { billId: "bill-old", title: "Old power bill", dueDate: "2026-10-25", amountPaise: 80000 },
    ]);
    expect(result.outgoingEvents).toHaveLength(0);
  });
});

describe("computeForecast - draft invoices", () => {
  it("a DRAFT invoice contributes no inflow and no uncertain entry", () => {
    const input = canonicalInput();
    input.invoices = [
      {
        id: "inv-draft",
        customerName: "Draft Client",
        invoiceNumber: "DRAFT-1",
        lifecycle: "DRAFT",
        dueDate: "2026-11-05",
        expectedCollectionDate: "2026-11-05",
        totalPaise: 9000000,
        payments: [],
      },
    ];
    input.bills = [];
    const result = computeForecast(input);
    expect(result.incomingEvents).toHaveLength(0);
    expect(result.uncertainInvoices).toHaveLength(0);
    expect(result.points.every((p) => p.incomingPaise === 0)).toBe(true);
    expect(result.endingCashPaise).toBe(2000000);
  });
});

describe("computeForecast - horizons", () => {
  it("60-day horizon gives 61 strictly ascending points", () => {
    const input = canonicalInput();
    input.horizonDays = 60;
    const result = computeForecast(input);
    expect(result.points).toHaveLength(61);
    const dates = result.points.map((p) => p.date);
    expect(dates[0]).toBe("2026-11-01");
    expect(dates[60]).toBe("2026-12-31");
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it("90-day horizon gives 91 strictly ascending points", () => {
    const input = canonicalInput();
    input.horizonDays = 90;
    const result = computeForecast(input);
    expect(result.points).toHaveLength(91);
    const dates = result.points.map((p) => p.date);
    expect(dates[0]).toBe("2026-11-01");
    expect(dates[90]).toBe("2027-01-30");
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });
});

describe("computeForecast - purity", () => {
  it("does not mutate the input", () => {
    const input = canonicalInput();
    input.shift = { invoiceId: "inv-a", delayDays: 15 };
    input.invoices[0].payments = [{ paymentDate: "2026-11-01", amountPaise: 300000 }];
    const before = structuredClone(input);
    computeForecast(input);
    expect(input).toEqual(before);
  });
});

describe("computeForecast - assumptions", () => {
  it("returns the five fixed assumptions in order", () => {
    const result = computeForecast(canonicalInput());
    expect(result.assumptions).toEqual([
      "Day-end cash: same-day events are netted",
      "Invoice due dates are estimated receipt dates, not guarantees",
      "Overdue invoices without an updated expected date are excluded from dated inflows",
      "Overdue unpaid bills have unknown settlement dates and are excluded from dated outflows",
      "Recorded cash counts only transactions entered in CashPilot after the opening snapshot date",
    ]);
  });
});
