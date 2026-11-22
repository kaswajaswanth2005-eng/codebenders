import { describe, it, expect } from "vitest";
import {
  addMonthsAnchored,
  classifyOccurrence,
  dueSoon,
  occurrencesInRange,
  type BillSchedule,
} from "../../src/lib/financial/bills";

const monthly = (firstDueDate: string, archivedOn: string | null = null): BillSchedule => ({
  firstDueDate,
  recurrence: "MONTHLY",
  archivedOn,
});

const oneTime = (firstDueDate: string): BillSchedule => ({
  firstDueDate,
  recurrence: "NONE",
  archivedOn: null,
});

describe("addMonthsAnchored", () => {
  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    expect(addMonthsAnchored("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("does not drift: Jan 31 + 2 months is Mar 31", () => {
    expect(addMonthsAnchored("2026-01-31", 2)).toBe("2026-03-31");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    expect(addMonthsAnchored("2028-01-31", 1)).toBe("2028-02-29");
  });
});

describe("occurrencesInRange", () => {
  it("generates anchored monthly dates with day-of-month clamp", () => {
    expect(occurrencesInRange(monthly("2026-01-31"), "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("returns a one-time bill only when its due date is inside the range", () => {
    expect(occurrencesInRange(oneTime("2026-03-15"), "2026-03-01", "2026-03-31")).toEqual([
      "2026-03-15",
    ]);
  });

  it("returns nothing for a one-time bill whose due date is outside the range", () => {
    expect(occurrencesInRange(oneTime("2026-03-15"), "2026-04-01", "2026-04-30")).toEqual([]);
    expect(occurrencesInRange(oneTime("2026-03-15"), "2026-01-01", "2026-02-28")).toEqual([]);
  });

  it("generates nothing before firstDueDate for a monthly bill", () => {
    const occ = occurrencesInRange(monthly("2026-03-10"), "2026-01-01", "2026-03-09");
    expect(occ).toEqual([]);
  });

  it("produces no occurrences on or after archivedOn for a monthly bill", () => {
    const occ = occurrencesInRange(monthly("2026-01-31", "2026-03-01"), "2026-01-01", "2026-12-31");
    expect(occ.length).toBeGreaterThan(0);
    expect(occ.every((d) => d < "2026-03-01")).toBe(true);
    expect(occ).toEqual(["2026-01-31", "2026-02-28"]);
  });

  it("never contains duplicate dates for a monthly bill", () => {
    const occ = occurrencesInRange(monthly("2026-01-31"), "2026-01-01", "2028-12-31");
    expect(new Set(occ).size).toBe(occ.length);
    expect(occ.length).toBeGreaterThan(0);
  });
});

describe("classifyOccurrence", () => {
  it("returns PAID when a payment date is recorded", () => {
    expect(classifyOccurrence("2026-03-01", "2026-03-02", "2026-03-10")).toBe("PAID");
  });

  it("returns OVERDUE when unpaid and due before today", () => {
    expect(classifyOccurrence("2026-03-01", null, "2026-03-10")).toBe("OVERDUE");
  });

  it("returns UPCOMING when unpaid and due after today", () => {
    expect(classifyOccurrence("2026-03-20", null, "2026-03-10")).toBe("UPCOMING");
  });

  it("returns UPCOMING when unpaid and due today", () => {
    expect(classifyOccurrence("2026-03-10", null, "2026-03-10")).toBe("UPCOMING");
  });
});

describe("dueSoon", () => {
  it("is true when due today", () => {
    expect(dueSoon("2026-03-10", "2026-03-10")).toBe(true);
  });

  it("is true when due exactly 7 days out", () => {
    expect(dueSoon("2026-03-17", "2026-03-10")).toBe(true);
  });

  it("is false when due 8 days out", () => {
    expect(dueSoon("2026-03-18", "2026-03-10")).toBe(false);
  });
});
