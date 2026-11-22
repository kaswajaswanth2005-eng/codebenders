import { describe, it, expect } from "vitest";
import {
  lineTotalPaise,
  invoiceTotalPaise,
  paidTotalPaise,
  outstandingPaise,
  deriveInvoiceStatus,
  isOverdue,
  overdueDays,
  validatePaymentAmount,
} from "@/lib/financial/invoices";
import { formatINR, rupeesToPaise } from "@/lib/financial/money";
import { isValidISODate } from "@/lib/financial/dates";
import { expectedCollectionUpdateSchema } from "@/lib/schemas/invoices";

describe("lineTotalPaise", () => {
  it("computes 1.5 units at 10000 paise as 15000 paise", () => {
    expect(lineTotalPaise(1500, 10000)).toBe(15000);
  });

  it("rounds 0.005 paise down to 0 (half-up formula, below half)", () => {
    // 1 milli-unit * 5 paise / 1000 = 0.005 paise
    expect(lineTotalPaise(1, 5)).toBe(0);
  });

  it("rounds exactly 0.5 paise up to 1 (half-up)", () => {
    // 100 milli-units * 5 paise / 1000 = 0.5 paise
    expect(lineTotalPaise(100, 5)).toBe(1);
    // 1 milli-unit * 500 paise / 1000 = 0.5 paise
    expect(lineTotalPaise(1, 500)).toBe(1);
  });

  it("rounds 1.5 paise up to 2 (half-up)", () => {
    // 1 milli-unit * 1500 paise / 1000 = 1.5 paise
    expect(lineTotalPaise(1, 1500)).toBe(2);
  });

  it("returns 0 for zero quantity", () => {
    expect(lineTotalPaise(0, 10000)).toBe(0);
  });

  it("returns 0 for zero unit price", () => {
    expect(lineTotalPaise(1500, 0)).toBe(0);
  });
});

describe("invoiceTotalPaise and paidTotalPaise", () => {
  it("sums line totals into the invoice total", () => {
    expect(
      invoiceTotalPaise([{ lineTotalPaise: 15000 }, { lineTotalPaise: 2500 }, { lineTotalPaise: 0 }]),
    ).toBe(17500);
  });

  it("returns 0 for an invoice with no items", () => {
    expect(invoiceTotalPaise([])).toBe(0);
  });

  it("sums payments into the paid total", () => {
    expect(paidTotalPaise([{ amountPaise: 1000 }, { amountPaise: 250 }])).toBe(1250);
  });

  it("returns 0 when there are no payments", () => {
    expect(paidTotalPaise([])).toBe(0);
  });
});

describe("outstandingPaise", () => {
  it("is total minus paid", () => {
    expect(outstandingPaise(4000000, 1500000)).toBe(2500000);
  });

  it("is 0 when fully paid", () => {
    expect(outstandingPaise(4000000, 4000000)).toBe(0);
  });

  it("clamps to 0 on overpayment", () => {
    expect(outstandingPaise(1000, 1500)).toBe(0);
  });
});

describe("deriveInvoiceStatus", () => {
  it("is DRAFT while the lifecycle is DRAFT, even with payments", () => {
    expect(deriveInvoiceStatus("DRAFT", 4000000, 0)).toBe("DRAFT");
    expect(deriveInvoiceStatus("DRAFT", 4000000, 4000000)).toBe("DRAFT");
  });

  it("is ISSUED_UNPAID when issued with no payments", () => {
    expect(deriveInvoiceStatus("ISSUED", 4000000, 0)).toBe("ISSUED_UNPAID");
  });

  it("is PARTIALLY_PAID when issued with some payment outstanding", () => {
    expect(deriveInvoiceStatus("ISSUED", 4000000, 1500000)).toBe("PARTIALLY_PAID");
  });

  it("is PAID when paid total reaches the invoice total", () => {
    expect(deriveInvoiceStatus("ISSUED", 4000000, 4000000)).toBe("PAID");
  });
});

describe("isOverdue", () => {
  it("is true for a partially paid invoice whose due date is before today", () => {
    expect(isOverdue("2026-11-10", 2500000, "ISSUED", "2026-11-21")).toBe(true);
  });

  it("is false when the due date is today", () => {
    expect(isOverdue("2026-11-21", 2500000, "ISSUED", "2026-11-21")).toBe(false);
  });

  it("is false for a DRAFT invoice even when past due", () => {
    expect(isOverdue("2026-11-10", 2500000, "DRAFT", "2026-11-21")).toBe(false);
  });

  it("is false for a paid invoice (outstanding 0) even when past due", () => {
    expect(isOverdue("2026-11-10", 0, "ISSUED", "2026-11-21")).toBe(false);
  });
});

describe("overdueDays", () => {
  it("counts 11 whole days from 2026-11-10 to 2026-11-21", () => {
    expect(overdueDays("2026-11-10", "2026-11-21")).toBe(11);
  });

  it("returns 0 when the due date is after today", () => {
    expect(overdueDays("2026-11-25", "2026-11-21")).toBe(0);
  });

  it("uses UTC day arithmetic across a month boundary", () => {
    expect(overdueDays("2026-02-28", "2026-03-01")).toBe(1);
  });
});

describe("validatePaymentAmount", () => {
  it("rejects zero", () => {
    expect(validatePaymentAmount(0, 1000)).toBe("Payment amount must be greater than zero");
  });

  it("rejects negative amounts", () => {
    expect(validatePaymentAmount(-1, 1000)).toBe("Payment amount must be greater than zero");
  });

  it("rejects an amount above the outstanding balance", () => {
    expect(validatePaymentAmount(1001, 1000)).toBe(
      "Payment amount cannot exceed the outstanding balance",
    );
  });

  it("accepts an amount equal to the outstanding balance", () => {
    expect(validatePaymentAmount(1000, 1000)).toBeNull();
  });

  it("accepts a single-paisa amount", () => {
    expect(validatePaymentAmount(1, 1000)).toBeNull();
  });
});

describe("40,000 example (4,000,000 paise total)", () => {
  it("leaves 2,500,000 outstanding after a 1,500,000 payment, then clears to PAID", () => {
    const total = 4000000;
    const firstPayment = 1500000;
    const paidAfterFirst = paidTotalPaise([{ amountPaise: firstPayment }]);
    expect(outstandingPaise(total, paidAfterFirst)).toBe(2500000);
    expect(deriveInvoiceStatus("ISSUED", total, paidAfterFirst)).toBe("PARTIALLY_PAID");

    const paidAfterSecond = paidTotalPaise([
      { amountPaise: firstPayment },
      { amountPaise: 2500000 },
    ]);
    expect(outstandingPaise(total, paidAfterSecond)).toBe(0);
    expect(deriveInvoiceStatus("ISSUED", total, paidAfterSecond)).toBe("PAID");
  });
});

describe("formatINR", () => {
  it("formats 0 as ₹0", () => {
    expect(formatINR(0)).toBe("₹0");
  });

  it("formats 1234567 paise as ₹12,345.67", () => {
    expect(formatINR(1234567)).toBe("₹12,345.67");
  });

  it("formats negative amounts with a leading minus", () => {
    expect(formatINR(-1000000)).toBe("-₹10,000");
  });

  it("uses Indian grouping for lakhs (100000000 paise = ₹10,00,000)", () => {
    expect(formatINR(100000000)).toBe("₹10,00,000");
  });
});

describe("rupeesToPaise", () => {
  it("converts whole and fractional rupees to integer paise", () => {
    expect(rupeesToPaise(12345.67)).toBe(1234567);
  });
});

describe("isValidISODate", () => {
  it("rejects 2026-02-30 (not a real calendar date)", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
  });

  it("accepts 2026-02-28", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
  });
});

describe("expected collection update", () => {
  it("accepts a valid date or an explicit null", () => {
    expect(expectedCollectionUpdateSchema.safeParse({ expectedCollectionDate: "2026-11-30" }).success).toBe(true);
    expect(expectedCollectionUpdateSchema.safeParse({ expectedCollectionDate: null }).success).toBe(true);
  });

  it("rejects an impossible calendar date", () => {
    expect(expectedCollectionUpdateSchema.safeParse({ expectedCollectionDate: "2026-02-30" }).success).toBe(false);
  });
});
