import { Prisma, type InvoicePayment } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { todayKolkata } from "@/lib/financial/dates";
import { formatINR } from "@/lib/financial/money";
import { lineTotalPaise, validatePaymentAmount, type InvoiceStatus } from "@/lib/financial/invoices";
import type {
  ExpectedCollectionUpdateInput,
  InvoiceDraftInput,
  InvoicePatchInput,
  InvoicePaymentInput,
} from "@/lib/schemas/invoices";
import { notFound, ServiceError } from "@/lib/services/errors";
import { deriveInvoiceFields, type InvoiceForView } from "@/lib/services/invoice-view";

type Tx = Prisma.TransactionClient;

const INVOICE_NUMBER_PATTERN = /^INV-(\d+)$/;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const invoiceInclude = {
  customer: { select: { id: true, name: true, companyName: true, email: true, phone: true } },
  items: { orderBy: { sortOrder: "asc" } },
  payments: { orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }] },
} satisfies Prisma.InvoiceInclude;

const totalsSelect = {
  lifecycle: true,
  dueDate: true,
  items: { select: { lineTotalPaise: true } },
  payments: { select: { amountPaise: true } },
} as const;

type ItemInput = { description: string; quantityMilli: number; unitPricePaise: number };

export type RecordPaymentResult = {
  payment: InvoicePayment;
  replayed: boolean;
  paidTotalPaise: number;
  outstandingPaise: number;
  status: InvoiceStatus;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function buildItemRows(items: ReadonlyArray<ItemInput>) {
  return items.map((item, index) => {
    try {
      return {
        description: item.description,
        quantityMilli: item.quantityMilli,
        unitPricePaise: item.unitPricePaise,
        lineTotalPaise: lineTotalPaise(item.quantityMilli, item.unitPricePaise),
        sortOrder: index,
      };
    } catch (error) {
      if (error instanceof RangeError) {
        throw new ServiceError("VALIDATION_ERROR", "A line amount is too large", {
          items: [`Line ${index + 1} amount is too large`],
        });
      }
      throw error;
    }
  });
}

async function assertCustomerUsable(tx: Tx, customerId: string): Promise<void> {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { archivedAt: true },
  });
  if (!customer) {
    throw notFound("Customer");
  }
  if (customer.archivedAt !== null) {
    throw new ServiceError("DOMAIN_RULE", "Archived customers cannot be assigned to new invoices");
  }
}

/**
 * Next invoice number: "INV-" plus the highest existing numeric suffix + 1, zero-padded to 4 digits.
 * Must be called with the transaction client so the read and the insert share one transaction.
 */
export async function nextInvoiceNumber(tx: Tx): Promise<string> {
  const rows = await tx.invoice.findMany({
    where: { invoiceNumber: { startsWith: "INV-" } },
    select: { invoiceNumber: true },
  });
  let highest = 0;
  for (const row of rows) {
    const match = INVOICE_NUMBER_PATTERN.exec(row.invoiceNumber);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return `INV-${String(highest + 1).padStart(4, "0")}`;
}

function withDerivedFields<T extends InvoiceForView>(invoice: T) {
  return { ...invoice, ...deriveInvoiceFields(invoice, todayKolkata()) };
}

export async function createDraft(input: InvoiceDraftInput) {
  try {
    const created = await prisma.$transaction(async (tx) => {
      await assertCustomerUsable(tx, input.customerId);
      const invoiceNumber = input.invoiceNumber ?? (await nextInvoiceNumber(tx));
      return tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: input.customerId,
          lifecycle: "DRAFT",
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          expectedCollectionDate: input.expectedCollectionDate,
          notes: input.notes ?? null,
          paymentInstructions: input.paymentInstructions ?? null,
          items: { create: buildItemRows(input.items) },
        },
        include: invoiceInclude,
      });
    });
    return withDerivedFields(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ServiceError("CONFLICT", "This invoice number is already in use");
    }
    throw error;
  }
}

/**
 * Edits a DRAFT invoice only. When items are supplied, they replace the existing items.
 */
export async function updateDraft(id: string, patch: InvoicePatchInput) {
  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        select: { lifecycle: true, customerId: true, issueDate: true, dueDate: true },
      });
      if (!invoice) {
        throw notFound("Invoice");
      }
      if (invoice.lifecycle !== "DRAFT") {
        throw new ServiceError("DOMAIN_RULE", "Issued invoices cannot be edited");
      }
      if (patch.customerId !== undefined && patch.customerId !== invoice.customerId) {
        throw new ServiceError(
          "DOMAIN_RULE",
          "This invoice belongs to one customer. Create a new invoice for the other customer instead.",
        );
      }
      if (patch.customerId !== undefined) {
        await assertCustomerUsable(tx, patch.customerId);
      }

      const issueDate = patch.issueDate ?? invoice.issueDate;
      const dueDate = patch.dueDate ?? invoice.dueDate;
      if (dueDate < issueDate) {
        throw new ServiceError("VALIDATION_ERROR", "Due date cannot be before issue date", {
          dueDate: ["Due date cannot be before issue date"],
        });
      }

      const data: Prisma.InvoiceUncheckedUpdateInput = {};
      if (patch.customerId !== undefined) data.customerId = patch.customerId;
      if (patch.invoiceNumber !== undefined) data.invoiceNumber = patch.invoiceNumber;
      if (patch.issueDate !== undefined) data.issueDate = patch.issueDate;
      if (patch.dueDate !== undefined) data.dueDate = patch.dueDate;
      if (patch.expectedCollectionDate !== undefined) {
        data.expectedCollectionDate = patch.expectedCollectionDate;
      }
      if (patch.notes !== undefined) data.notes = patch.notes;
      if (patch.paymentInstructions !== undefined) data.paymentInstructions = patch.paymentInstructions;

      if (patch.items !== undefined) {
        const rows = buildItemRows(patch.items);
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: rows.map((row) => ({ ...row, invoiceId: id })),
        });
      }

      await tx.invoice.update({ where: { id }, data });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ServiceError("CONFLICT", "This invoice number is already in use");
    }
    throw error;
  }
  return getInvoiceDetail(id);
}

/**
 * Moves a DRAFT to ISSUED. Payments are untouched.
 */
export async function issueInvoice(id: string) {
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      select: {
        lifecycle: true,
        issueDate: true,
        dueDate: true,
        _count: { select: { items: true } },
      },
    });
    if (!invoice) {
      throw notFound("Invoice");
    }
    if (invoice.lifecycle !== "DRAFT") {
      throw new ServiceError("DOMAIN_RULE", "Only draft invoices can be issued");
    }
    if (invoice._count.items < 1) {
      throw new ServiceError("DOMAIN_RULE", "Issuing an empty invoice is not allowed");
    }
    if (invoice.dueDate < invoice.issueDate) {
      throw new ServiceError("DOMAIN_RULE", "Due date cannot be before issue date");
    }
    const result = await tx.invoice.updateMany({
      where: { id, lifecycle: "DRAFT" },
      data: { lifecycle: "ISSUED" },
    });
    if (result.count !== 1) {
      throw new ServiceError("DOMAIN_RULE", "Only draft invoices can be issued");
    }
  });
  return getInvoiceDetail(id);
}

/**
 * Updates only the collection expectation for an issued invoice. Financial facts and the legal
 * due date remain locked. A cleared date makes an overdue invoice explicitly uncertain again.
 */
export async function updateExpectedCollectionDate(
  id: string,
  input: ExpectedCollectionUpdateInput,
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { lifecycle: true },
  });
  if (!invoice) throw notFound("Invoice");
  if (invoice.lifecycle !== "ISSUED") {
    throw new ServiceError("DOMAIN_RULE", "Issue the invoice before setting a collection expectation");
  }
  if (input.expectedCollectionDate !== null && input.expectedCollectionDate < todayKolkata()) {
    throw new ServiceError(
      "DOMAIN_RULE",
      "Expected collection date must be today or later",
      { expectedCollectionDate: ["Expected collection date must be today or later"] },
    );
  }
  await prisma.invoice.update({
    where: { id },
    data: { expectedCollectionDate: input.expectedCollectionDate },
  });
  return getInvoiceDetail(id);
}

function matchesStoredPayment(
  existing: InvoicePayment,
  invoiceId: string,
  input: InvoicePaymentInput,
): boolean {
  return (
    existing.invoiceId === invoiceId &&
    existing.amountPaise === input.amountPaise &&
    existing.paymentDate === input.paymentDate &&
    existing.method === input.method &&
    (existing.referenceNumber ?? null) === (input.referenceNumber ?? null)
  );
}

/**
 * Records a payment against an ISSUED invoice. Replaying the same idempotency key with the
 * same payload returns the stored payment (replayed: true). A key reused with a different
 * payload is a CONFLICT.
 *
 * Runs in a default-isolation interactive transaction (see notes on SQLite isolation).
 */
export async function recordPayment(
  invoiceId: string,
  input: InvoicePaymentInput,
): Promise<RecordPaymentResult> {
  const today = todayKolkata();
  try {
    return await prisma.$transaction(async (tx): Promise<RecordPaymentResult> => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: totalsSelect });
      if (!invoice) {
        throw notFound("Invoice");
      }

      const existing = await tx.invoicePayment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        if (!matchesStoredPayment(existing, invoiceId, input)) {
          throw new ServiceError(
            "CONFLICT",
            "This idempotency key was already used for a different payment",
          );
        }
        const fields = deriveInvoiceFields(invoice, today);
        return {
          payment: existing,
          replayed: true,
          paidTotalPaise: fields.paidPaise,
          outstandingPaise: fields.outstandingPaise,
          status: fields.status,
        };
      }

      if (invoice.lifecycle !== "ISSUED") {
        throw new ServiceError("DOMAIN_RULE", "Payments can only be recorded on issued invoices");
      }
      const before = deriveInvoiceFields(invoice, today);
      const outstanding = before.outstandingPaise;
      const problem = validatePaymentAmount(input.amountPaise, outstanding);
      if (problem !== null) {
        throw new ServiceError(
          "DOMAIN_RULE",
          input.amountPaise > outstanding
            ? `Payment of ${formatINR(input.amountPaise)} exceeds the outstanding balance of ${formatINR(outstanding)}`
            : problem,
        );
      }
      if (input.paymentDate > today) {
        throw new ServiceError("DOMAIN_RULE", "Payment date cannot be in the future");
      }

      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId,
          amountPaise: input.amountPaise,
          paymentDate: input.paymentDate,
          method: input.method,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey,
        },
      });

      const after = deriveInvoiceFields(
        { ...invoice, payments: [...invoice.payments, { amountPaise: input.amountPaise }] },
        today,
      );
      return {
        payment,
        replayed: false,
        paidTotalPaise: after.paidPaise,
        outstandingPaise: after.outstandingPaise,
        status: after.status,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ServiceError(
        "CONFLICT",
        "This idempotency key was already used for a different payment",
      );
    }
    throw error;
  }
}

export type InvoiceListFilters = {
  status?: InvoiceStatus | "OVERDUE";
  customerId?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
};

export async function listInvoices(filters: InvoiceListFilters = {}) {
  const today = todayKolkata();
  const search = filters.search?.trim();
  const lifecycle =
    filters.status === undefined ? undefined : filters.status === "DRAFT" ? "DRAFT" : "ISSUED";

  const rows = await prisma.invoice.findMany({
    where: {
      ...(lifecycle ? { lifecycle } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(
        filters.dueFrom || filters.dueTo
          ? {
              dueDate: {
                ...(filters.dueFrom ? { gte: filters.dueFrom } : {}),
                ...(filters.dueTo ? { lte: filters.dueTo } : {}),
              },
            }
          : {}
      ),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search } },
              { customer: { name: { contains: search } } },
            ],
          }
        : {}),
    },
    orderBy: [{ dueDate: "asc" }, { invoiceNumber: "asc" }],
    include: {
      customer: { select: { id: true, name: true, companyName: true } },
      items: { select: { lineTotalPaise: true } },
      payments: { select: { amountPaise: true } },
    },
  });

  return rows
    .map(({ items, payments, ...invoice }) => ({
      ...invoice,
      ...deriveInvoiceFields(
        { lifecycle: invoice.lifecycle, dueDate: invoice.dueDate, items, payments },
        today,
      ),
    }))
    .filter((row) => {
      if (filters.status === undefined) return true;
      if (filters.status === "OVERDUE") return row.overdue;
      return row.status === filters.status;
    });
}

export async function getInvoiceDetail(id: string) {
  const row = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!row) {
    throw notFound("Invoice");
  }
  return withDerivedFields(row);
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * Deterministic reminder text. Returns null when nothing is outstanding (or the invoice is not issued).
 * The text is a draft only; nothing is sent.
 */
export async function buildReminderText(invoiceId: string): Promise<string | null> {
  const today = todayKolkata();
  const row = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: { select: { name: true } },
      items: { select: { lineTotalPaise: true } },
      payments: { select: { amountPaise: true } },
    },
  });
  if (!row) {
    throw notFound("Invoice");
  }
  const fields = deriveInvoiceFields(row, today);
  if (row.lifecycle !== "ISSUED" || fields.outstandingPaise <= 0) {
    return null;
  }

  const dueClause = fields.overdue
    ? `is now ${fields.overdueDays} ${fields.overdueDays === 1 ? "day" : "days"} overdue`
    : `is due on ${formatDisplayDate(row.dueDate)}`;

  return `Hello ${row.customer.name}, this is a reminder that invoice ${row.invoiceNumber} has ${formatINR(fields.outstandingPaise)} outstanding and ${dueClause}. Please confirm the expected payment date. Thank you.`;
}
