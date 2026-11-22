import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/lib/alerts/rules";

describe("Action Center rules", () => {
  it("creates overdue, due-soon, bill, past-due and cash-shortfall actions", () => {
    const alerts = buildAlerts({
      today: "2026-11-21",
      overdueInvoices: [
        { id: "i1", invoiceNumber: "INV-0001", customerName: "A", outstandingPaise: 100_000, overdueDays: 5 },
        { id: "i2", invoiceNumber: "INV-0002", customerName: "B", outstandingPaise: 200_000, overdueDays: 2 },
        { id: "i3", invoiceNumber: "INV-0003", customerName: "C", outstandingPaise: 300_000, overdueDays: 1 },
      ],
      dueSoonInvoices: [
        { id: "i4", invoiceNumber: "INV-0004", customerName: "D", outstandingPaise: 400_000, dueDate: "2026-11-23" },
      ],
      unpaidBills: [
        { billId: "b1", title: "Rent", dueDate: "2026-11-25", amountPaise: 500_000 },
      ],
      pastDueBills: [
        { billId: "b2", title: "Utilities", dueDate: "2026-11-20", amountPaise: 60_000 },
      ],
      cashShortfall: { date: "2026-11-29", minimumCashPaise: -75_000 },
    });

    expect(alerts.map((alert) => alert.type)).toEqual([
      "CASH_SHORTFALL",
      "MULTIPLE_OVERDUE",
      "INVOICE_OVERDUE",
      "INVOICE_OVERDUE",
      "INVOICE_OVERDUE",
      "INVOICE_DUE_SOON",
      "BILL_DUE_SOON",
      "PAST_DUE_BILL",
    ]);
    expect(alerts.find((alert) => alert.type === "INVOICE_OVERDUE")?.actionHref).toContain(
      "#payment-reminder",
    );
    expect(alerts.find((alert) => alert.type === "CASH_SHORTFALL")?.explanation).toContain(
      "-₹750",
    );
  });

  it("excludes bills and invoices outside their due-soon windows", () => {
    const alerts = buildAlerts({
      today: "2026-11-21",
      overdueInvoices: [],
      dueSoonInvoices: [
        { id: "i1", invoiceNumber: "INV-0001", customerName: "A", outstandingPaise: 100_000, dueDate: "2026-11-25" },
      ],
      unpaidBills: [
        { billId: "b1", title: "Later bill", dueDate: "2026-11-29", amountPaise: 500_000 },
      ],
    });

    expect(alerts).toEqual([]);
  });
});
