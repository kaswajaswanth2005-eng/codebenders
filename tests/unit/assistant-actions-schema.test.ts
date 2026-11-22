import { describe, expect, it } from "vitest";
import {
  assistantConfirmSchema,
  assistantPrepareSchema,
} from "@/lib/schemas/assistant-actions";

describe("assistantPrepareSchema", () => {
  it("trims a valid command", () => {
    expect(assistantPrepareSchema.parse({ message: "  invoice 5000 for ABC  " })).toEqual({
      message: "invoice 5000 for ABC",
    });
  });

  it("rejects empty and oversized commands", () => {
    expect(assistantPrepareSchema.safeParse({ message: "  " }).success).toBe(false);
    expect(assistantPrepareSchema.safeParse({ message: "x".repeat(301) }).success).toBe(false);
  });
});

describe("assistantConfirmSchema", () => {
  it("accepts one existing customer and a real due date", () => {
    expect(
      assistantConfirmSchema.safeParse({
        customerId: "customer-1",
        amountRupees: 5000.75,
        dueDate: "2026-12-20",
      }).success,
    ).toBe(true);
  });

  it("accepts one new customer name", () => {
    expect(
      assistantConfirmSchema.safeParse({
        newCustomerName: "New Client",
        amountRupees: 1,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["neither customer field", { amountRupees: 5000 }],
    [
      "both customer fields",
      { customerId: "customer-1", newCustomerName: "New Client", amountRupees: 5000 },
    ],
    ["zero amount", { customerId: "customer-1", amountRupees: 0 }],
    ["negative amount", { customerId: "customer-1", amountRupees: -1 }],
    ["oversized amount", { customerId: "customer-1", amountRupees: 10_000_001 }],
    [
      "impossible due date",
      { customerId: "customer-1", amountRupees: 5000, dueDate: "2026-02-30" },
    ],
  ])("rejects %s", (_label, input) => {
    expect(assistantConfirmSchema.safeParse(input).success).toBe(false);
  });
});
