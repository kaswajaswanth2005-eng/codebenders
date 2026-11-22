import { z } from "zod";
import { isValidISODate } from "@/lib/financial/dates";
import { rupeesToPaise } from "@/lib/financial/money";

export const PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "OTHER"] as const;

const optionalTrimmed = (max: number, label: string) =>
  z
    .union([z.string().trim().max(max, `${label} must be ${max} characters or fewer`), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "" || value === null ? null : value));

const isoDate = (label: string) =>
  z.string().trim().refine(isValidISODate, { message: `${label} must be a valid date` });

const itemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Item description is required")
    .max(200, "Item description must be 200 characters or fewer"),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .finite("Quantity must be a number")
    .gt(0, "Quantity must be greater than zero")
    .lte(1000000, "Quantity is too large")
    .refine(
      (q) => {
        const milli = Math.round(q * 1000);
        return Number.isInteger(milli) && Math.abs(q * 1000 - milli) < 1e-9;
      },
      { message: "Quantity can have at most 3 decimal places" },
    ),
  unitPriceRupees: z
    .number({ invalid_type_error: "Unit price must be a number" })
    .finite("Unit price must be a number")
    .gte(0, "Unit price cannot be negative")
    .lte(10000000, "Unit price is too large"),
});

const invoiceFieldsShape = {
  customerId: z.string().trim().min(1, "Customer is required"),
  invoiceNumber: z
    .string()
    .trim()
    .min(1, "Invoice number cannot be empty")
    .max(40, "Invoice number must be 40 characters or fewer")
    .optional(),
  issueDate: isoDate("Issue date"),
  dueDate: isoDate("Due date"),
  expectedCollectionDate: z
    .union([isoDate("Expected collection date"), z.null()])
    .optional(),
  notes: optionalTrimmed(2000, "Notes"),
  paymentInstructions: optionalTrimmed(2000, "Payment instructions"),
  items: z
    .array(itemSchema)
    .min(1, "Add at least one line item")
    .max(100, "An invoice can have at most 100 line items"),
};

function dueOnOrAfterIssue(value: { issueDate?: string; dueDate?: string }): boolean {
  if (value.issueDate === undefined || value.dueDate === undefined) {
    return true;
  }
  return value.dueDate >= value.issueDate;
}

const DUE_DATE_MESSAGE = { message: "Due date cannot be before issue date", path: ["dueDate"] };

export const invoiceDraftSchema = z
  .object(invoiceFieldsShape)
  .refine(dueOnOrAfterIssue, DUE_DATE_MESSAGE)
  .transform((value) => ({
    customerId: value.customerId,
    invoiceNumber: value.invoiceNumber,
    issueDate: value.issueDate,
    dueDate: value.dueDate,
    expectedCollectionDate: value.expectedCollectionDate ?? null,
    notes: value.notes,
    paymentInstructions: value.paymentInstructions,
    items: value.items.map((item) => ({
      description: item.description,
      quantityMilli: Math.round(item.quantity * 1000),
      unitPricePaise: rupeesToPaise(item.unitPriceRupees),
    })),
  }));

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>;

/**
 * Patch applies only to DRAFT invoices; every field is optional.
 */
export const invoicePatchSchema = z
  .object({
    customerId: invoiceFieldsShape.customerId.optional(),
    invoiceNumber: invoiceFieldsShape.invoiceNumber,
    issueDate: invoiceFieldsShape.issueDate.optional(),
    dueDate: invoiceFieldsShape.dueDate.optional(),
    expectedCollectionDate: invoiceFieldsShape.expectedCollectionDate,
    notes: invoiceFieldsShape.notes,
    paymentInstructions: invoiceFieldsShape.paymentInstructions,
    items: invoiceFieldsShape.items.optional(),
  })
  .refine(dueOnOrAfterIssue, DUE_DATE_MESSAGE)
  .transform((value) => ({
    ...value,
    items:
      value.items === undefined
        ? undefined
        : value.items.map((item) => ({
            description: item.description,
            quantityMilli: Math.round(item.quantity * 1000),
            unitPricePaise: rupeesToPaise(item.unitPriceRupees),
          })),
  }));

export type InvoicePatchInput = z.infer<typeof invoicePatchSchema>;

export const invoicePaymentSchema = z
  .object({
    amountRupees: z
      .number({ invalid_type_error: "Amount must be a number" })
      .finite("Amount must be a number")
      .gt(0, "Amount must be greater than zero"),
    paymentDate: isoDate("Payment date"),
    method: z.enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: "Choose a payment method" }),
    }),
    referenceNumber: optionalTrimmed(80, "Reference number"),
    notes: optionalTrimmed(500, "Notes"),
    idempotencyKey: z
      .string()
      .trim()
      .min(8, "Idempotency key must be at least 8 characters")
      .max(80, "Idempotency key must be 80 characters or fewer"),
  })
  .transform((value, ctx) => {
    const amountPaise = rupeesToPaise(value.amountRupees);
    if (amountPaise <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be at least one paisa",
        path: ["amountRupees"],
      });
      return z.NEVER;
    }
    return {
      amountPaise,
      paymentDate: value.paymentDate,
      method: value.method,
      referenceNumber: value.referenceNumber,
      notes: value.notes,
      idempotencyKey: value.idempotencyKey,
    };
  });

export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;

export const expectedCollectionUpdateSchema = z.object({
  expectedCollectionDate: z.union([isoDate("Expected collection date"), z.null()]),
});

export type ExpectedCollectionUpdateInput = z.infer<typeof expectedCollectionUpdateSchema>;
