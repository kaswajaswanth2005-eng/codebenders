import { describe, it, expect } from "vitest";
import {
  parseInvoiceCommand,
  parsePendingInvoiceReply,
  matchCustomers,
  normaliseName,
  type CustomerCandidate,
} from "@/lib/assistant/invoice-command";

const abcCompany: CustomerCandidate = { id: "c1", name: "ABC Company", companyName: null };
const blueLotus: CustomerCandidate = { id: "c2", name: "Blue Lotus Cafe", companyName: null };
const abcEnterprises: CustomerCandidate = { id: "c3", name: "ABC Enterprises", companyName: null };

describe("parseInvoiceCommand", () => {
  it("parses 'add invoice of 5000 in abc'", () => {
    const result = parseInvoiceCommand("add invoice of 5000 in abc");
    expect(result).toEqual({ amountPaise: 500000, customerQuery: "abc" });
  });

  it("parses comma groups and 'for' customer", () => {
    const result = parseInvoiceCommand("create invoice 5,000 for ABC Company");
    expect(result).toEqual({ amountPaise: 500000, customerQuery: "ABC Company" });
  });

  it("parses the amount-first fallback form", () => {
    const result = parseInvoiceCommand("invoice abc 5000");
    expect(result).toEqual({ amountPaise: 500000, customerQuery: "abc" });
  });

  it("parses and removes an explicit due date from the customer name", () => {
    const result = parseInvoiceCommand("add invoice of 5000 in ABC due 2026-12-20");
    expect(result).toEqual({
      amountPaise: 500000,
      customerQuery: "ABC",
      dueDate: "2026-12-20",
    });
  });

  it("rejects an impossible explicit due date", () => {
    const result = parseInvoiceCommand("add invoice of 5000 in ABC due 2026-02-30");
    expect(result).toEqual({ error: "Due date must be a real date in YYYY-MM-DD format" });
  });

  it("returns an error when the request is not about invoices", () => {
    expect("error" in parseInvoiceCommand("hello")).toBe(true);
  });

  it("returns an error when the amount is missing", () => {
    expect("error" in parseInvoiceCommand("add invoice in abc")).toBe(true);
  });

  it.each([
    ["zero", "add invoice of 0 in ABC"],
    ["negative", "add invoice of -500 in ABC"],
    ["above the maximum", "add invoice of 10000001 in ABC"],
    ["too many decimal places", "add invoice of 5000.999 in ABC"],
  ])("rejects a %s amount", (_label, command) => {
    expect("error" in parseInvoiceCommand(command)).toBe(true);
  });

  it("accepts the maximum amount and two decimal places", () => {
    expect(parseInvoiceCommand("add invoice of 1,00,00,000 in ABC")).toEqual({
      amountPaise: 1_000_000_000,
      customerQuery: "ABC",
    });
    expect(parseInvoiceCommand("add invoice of 5000.75 in ABC")).toEqual({
      amountPaise: 500_075,
      customerQuery: "ABC",
    });
  });

  it("returns an error when the customer is missing", () => {
    expect(parseInvoiceCommand("add invoice of 5000")).toEqual({
      error: "Tell me the customer name, for example 'in ABC'",
    });
  });
});

describe("parsePendingInvoiceReply", () => {
  it("keeps no-due-date feedback inside the invoice workflow", () => {
    expect(parsePendingInvoiceReply("no due date")).toEqual({ kind: "due-date-required" });
  });

  it("accepts a replacement due date", () => {
    expect(parsePendingInvoiceReply("due 2026-12-20")).toEqual({
      kind: "set-due-date",
      dueDate: "2026-12-20",
    });
  });

  it("understands confirmation and cancellation replies", () => {
    expect(parsePendingInvoiceReply("save it")).toEqual({ kind: "confirm" });
    expect(parsePendingInvoiceReply("cancel")).toEqual({ kind: "cancel" });
  });

  it("asks for a valid date when a due-date reply is incomplete", () => {
    expect(parsePendingInvoiceReply("change the due date")).toEqual({
      kind: "invalid-due-date",
    });
  });

  it.each(["yes", "confirm it", "go ahead", "create it", "looks good", "ok"])(
    "recognizes '%s' as confirmation",
    (reply) => {
      expect(parsePendingInvoiceReply(reply)).toEqual({ kind: "confirm" });
    },
  );

  it.each(["no", "stop", "never mind", "don't save", "do not save"])(
    "recognizes '%s' as cancellation",
    (reply) => {
      expect(parsePendingInvoiceReply(reply)).toEqual({ kind: "cancel" });
    },
  );

  it("rejects an impossible replacement due date", () => {
    expect(parsePendingInvoiceReply("due 2026-02-30")).toEqual({
      kind: "invalid-due-date",
    });
  });

  it("does not claim unrelated conversation as an invoice reply", () => {
    expect(parsePendingInvoiceReply("how much do customers owe me?")).toEqual({ kind: "none" });
  });
});

describe("normaliseName", () => {
  it("drops company suffixes and punctuation", () => {
    expect(normaliseName("ABC Company")).toBe("abc");
    expect(normaliseName("A.B.C. Pvt. Ltd.")).toBe("a b c");
  });
});

describe("matchCustomers", () => {
  it("matches a single clear customer", () => {
    const result = matchCustomers("abc", [abcCompany, blueLotus]);
    expect(result).toEqual({ kind: "match", customer: abcCompany });
  });

  it("asks to choose when several customers match", () => {
    const result = matchCustomers("abc", [abcCompany, abcEnterprises]);
    expect(result.kind).toBe("choose");
    if (result.kind === "choose") {
      const ids = result.options.map((o) => o.id).sort();
      expect(ids).toEqual(["c1", "c3"]);
    }
  });

  it("returns none when nothing is close", () => {
    expect(matchCustomers("xyz", [abcCompany])).toEqual({ kind: "none" });
  });

  it("matches a partially typed name", () => {
    const result = matchCustomers("blue lotu", [blueLotus]);
    expect(result).toEqual({ kind: "match", customer: blueLotus });
  });
});
