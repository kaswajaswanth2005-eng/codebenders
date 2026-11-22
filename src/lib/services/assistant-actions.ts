import { isValidISODate, todayKolkata } from "@/lib/financial/dates";
import { rupeesToPaise } from "@/lib/financial/money";
import {
  matchCustomers,
  parseInvoiceCommand,
  type CustomerCandidate,
} from "@/lib/assistant/invoice-command";
import { createCustomer, getCustomerDetail, listCustomers } from "@/lib/services/customers";
import { ServiceError, notFound } from "@/lib/services/errors";
import { createDraft } from "@/lib/services/invoices";

const PAYMENT_TERM_DAYS = 14;
const MAX_RUPEES = 10_000_000;
const DESCRIPTION = "Services (from assistant command)";

export type PrepareResult =
  | { status: "error"; message: string }
  | {
      status: "choose";
      amountPaise: number;
      customerQuery: string;
      options: CustomerCandidate[];
      issueDate: string;
      dueDate: string;
      dueDateIsDefault: boolean;
    }
  | {
      status: "new-customer";
      amountPaise: number;
      customerName: string;
      issueDate: string;
      dueDate: string;
      dueDateIsDefault: boolean;
    }
  | {
      status: "ready";
      amountPaise: number;
      customer: CustomerCandidate;
      summary: {
        customerName: string;
        amountPaise: number;
        issueDate: string;
        dueDate: string;
        dueDateIsDefault: boolean;
        description: string;
      };
    };

/**
 * Adds whole days to a YYYY-MM-DD string using UTC date arithmetic (no timezone drift).
 */
function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Parses a natural-language invoice command and matches the customer. Writes nothing.
 */
export async function prepareInvoiceCommand(message: string): Promise<PrepareResult> {
  const parsed = parseInvoiceCommand(message);
  if ("error" in parsed) {
    return { status: "error", message: parsed.error };
  }

  const rows = await listCustomers();
  const candidates: CustomerCandidate[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    companyName: row.companyName,
  }));

  const issueDate = todayKolkata();
  const dueDate = parsed.dueDate ?? addDays(issueDate, PAYMENT_TERM_DAYS);
  const dueDateIsDefault = parsed.dueDate === undefined;
  if (dueDate < issueDate) {
    return { status: "error", message: "Due date cannot be before the issue date" };
  }

  const match = matchCustomers(parsed.customerQuery, candidates);
  if (match.kind === "none") {
    return {
      status: "new-customer",
      amountPaise: parsed.amountPaise,
      customerName: parsed.customerQuery,
      issueDate,
      dueDate,
      dueDateIsDefault,
    };
  }
  if (match.kind === "choose") {
    return {
      status: "choose",
      amountPaise: parsed.amountPaise,
      customerQuery: parsed.customerQuery,
      options: match.options,
      issueDate,
      dueDate,
      dueDateIsDefault,
    };
  }

  return {
    status: "ready",
    amountPaise: parsed.amountPaise,
    customer: match.customer,
    summary: {
      customerName: match.customer.name,
      amountPaise: parsed.amountPaise,
      issueDate,
      dueDate,
      dueDateIsDefault,
      description: DESCRIPTION,
    },
  };
}

/**
 * Creates the DRAFT invoice after the user confirms. Creates the customer first when
 * newCustomerName is given. Exactly one of customerId or newCustomerName must be set.
 */
export async function confirmInvoiceCommand(input: {
  customerId?: string;
  newCustomerName?: string;
  amountRupees: number;
  dueDate?: string;
}): Promise<{ invoiceId: string; invoiceNumber: string }> {
  if (!Number.isFinite(input.amountRupees) || input.amountRupees <= 0 || input.amountRupees > MAX_RUPEES) {
    throw new ServiceError("VALIDATION_ERROR", "Amount must be more than 0 and at most 10000000 rupees", {
      amountRupees: ["Amount must be more than 0 and at most 10000000 rupees"],
    });
  }
  const hasCustomerId = input.customerId !== undefined;
  const hasNewName = input.newCustomerName !== undefined;
  if (hasCustomerId === hasNewName) {
    throw new ServiceError("VALIDATION_ERROR", "Provide exactly one of customerId or newCustomerName");
  }

  const issueDate = todayKolkata();
  const dueDate = input.dueDate ?? addDays(issueDate, PAYMENT_TERM_DAYS);
  if (!isValidISODate(dueDate) || dueDate < issueDate) {
    throw new ServiceError("VALIDATION_ERROR", "Due date must be a valid date on or after the issue date", {
      dueDate: ["Due date must be a valid date on or after the issue date"],
    });
  }

  let customerId: string;
  if (input.customerId !== undefined) {
    const detail = await getCustomerDetail(input.customerId);
    if (detail.customer.archivedAt !== null) {
      throw notFound("Customer");
    }
    customerId = detail.customer.id;
  } else {
    const created = await createCustomer({ name: input.newCustomerName ?? "" });
    customerId = created.id;
  }

  const invoice = await createDraft({
    customerId,
    invoiceNumber: undefined,
    issueDate,
    dueDate,
    expectedCollectionDate: null,
    notes: undefined,
    paymentInstructions: undefined,
    items: [
      {
        description: DESCRIPTION,
        quantityMilli: 1000,
        unitPricePaise: rupeesToPaise(input.amountRupees),
      },
    ],
  });

  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
}
