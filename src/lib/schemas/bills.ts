import { z } from "zod";
import { isValidISODate, todayKolkata } from "@/lib/financial/dates";
import { addDaysISO, daysBetween } from "@/lib/financial/bills";
import { rupeesToPaise } from "@/lib/financial/money";

export const BILL_CATEGORIES = [
  "Rent",
  "Salaries",
  "Software",
  "Utilities",
  "Suppliers",
  "Marketing",
  "Other",
] as const;

export const BILL_RECURRENCES = ["NONE", "MONTHLY"] as const;

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 90;

const optionalTrimmed = (max: number, label: string) =>
  z
    .union([z.string().trim().max(max, `${label} must be ${max} characters or fewer`), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "" || value === null ? null : value));

const isoDate = (label: string) =>
  z.string().trim().refine(isValidISODate, { message: `${label} must be a valid date` });

const amountRupees = z
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a number")
  .gt(0, "Amount must be greater than zero")
  .lte(10000000, "Amount is too large");

const billFieldsShape = {
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or fewer"),
  category: z.enum(BILL_CATEGORIES, {
    errorMap: () => ({ message: "Choose a category" }),
  }),
  amountRupees,
  firstDueDate: isoDate("First due date"),
  recurrence: z.enum(BILL_RECURRENCES, {
    errorMap: () => ({ message: "Choose a recurrence" }),
  }),
  notes: optionalTrimmed(1000, "Notes"),
};

/**
 * Converts rupees to paise and rejects amounts that round to zero paise.
 * Returns null after adding an issue to ctx.
 */
function amountToPaise(rupees: number, ctx: z.RefinementCtx): number | null {
  const paise = rupeesToPaise(rupees);
  if (paise <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Amount must be at least one paisa",
      path: ["amountRupees"],
    });
    return null;
  }
  return paise;
}

export const billInputSchema = z
  .object(billFieldsShape)
  .transform((value, ctx) => {
    const defaultAmountPaise = amountToPaise(value.amountRupees, ctx);
    if (defaultAmountPaise === null) {
      return z.NEVER;
    }
    return {
      title: value.title,
      category: value.category,
      defaultAmountPaise,
      firstDueDate: value.firstDueDate,
      recurrence: value.recurrence,
      notes: value.notes ?? null,
    };
  });

export type BillInput = z.infer<typeof billInputSchema>;

/**
 * Patch: every field optional. archived: true sets archivedOn to today (if not already archived);
 * archived: false clears archivedOn.
 */
export const billPatchSchema = z
  .object({
    title: billFieldsShape.title.optional(),
    category: billFieldsShape.category.optional(),
    amountRupees: billFieldsShape.amountRupees.optional(),
    firstDueDate: billFieldsShape.firstDueDate.optional(),
    recurrence: billFieldsShape.recurrence.optional(),
    notes: billFieldsShape.notes,
    archived: z.boolean({ invalid_type_error: "Archived must be true or false" }).optional(),
  })
  .transform((value, ctx) => {
    let defaultAmountPaise: number | undefined;
    if (value.amountRupees !== undefined) {
      const paise = amountToPaise(value.amountRupees, ctx);
      if (paise === null) {
        return z.NEVER;
      }
      defaultAmountPaise = paise;
    }
    return {
      title: value.title,
      category: value.category,
      defaultAmountPaise,
      firstDueDate: value.firstDueDate,
      recurrence: value.recurrence,
      notes: value.notes,
      archived: value.archived,
    };
  });

export type BillPatchInput = z.infer<typeof billPatchSchema>;

/**
 * Pay request. dueDate comes from the URL and is merged in by the route.
 * MVP rule: full payment only. A supplied amount is returned so the service can check it against
 * the occurrence amount. paidDate must not be in the future; the service enforces that (422).
 */
export const billPayOccurrenceSchema = z
  .object({
    dueDate: isoDate("Due date"),
    paidDate: isoDate("Paid date"),
    amountRupees: z
      .number({ invalid_type_error: "Amount must be a number" })
      .finite("Amount must be a number")
      .gt(0, "Amount must be greater than zero")
      .optional(),
  })
  .transform((value, ctx) => {
    if (value.amountRupees === undefined) {
      return { dueDate: value.dueDate, paidDate: value.paidDate, amountPaise: undefined };
    }
    const amountPaise = amountToPaise(value.amountRupees, ctx);
    if (amountPaise === null) {
      return z.NEVER;
    }
    return { dueDate: value.dueDate, paidDate: value.paidDate, amountPaise };
  });

export type BillPayOccurrenceInput = z.infer<typeof billPayOccurrenceSchema>;

/**
 * Inclusive from/to range. Span is limited to MAX_RANGE_DAYS.
 */
export const billRangeSchema = z
  .object({
    from: isoDate("From date"),
    to: isoDate("To date"),
  })
  .refine((range) => range.from <= range.to, {
    message: "From date must be on or before the to date",
    path: ["to"],
  })
  .refine((range) => daysBetween(range.from, range.to) <= MAX_RANGE_DAYS, {
    message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
    path: ["to"],
  });

/**
 * Applies defaults: from = today (Kolkata), to = from + 90 days. Returns the zod result.
 */
export function parseBillRange(from: string | null, to: string | null) {
  const start = from || todayKolkata();
  const end = to || addDaysISO(start, DEFAULT_RANGE_DAYS);
  return billRangeSchema.safeParse({ from: start, to: end });
}
