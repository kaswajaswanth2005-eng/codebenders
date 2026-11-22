import { z } from "zod";
import { isValidISODate } from "@/lib/financial/dates";

// Request bodies for the assistant invoice-command routes.

export const assistantPrepareSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Type a command, for example: add invoice of 5000 in ABC")
    .max(300, "Commands must be 300 characters or fewer"),
});

export type AssistantPrepareInput = z.infer<typeof assistantPrepareSchema>;

export const assistantConfirmSchema = z
  .object({
    customerId: z.string().trim().min(1, "Customer is required").optional(),
    newCustomerName: z
      .string()
      .trim()
      .min(1, "Customer name is required")
      .max(120, "Customer name must be 120 characters or fewer")
      .optional(),
    amountRupees: z
      .number({ invalid_type_error: "Amount must be a number" })
      .finite("Amount must be a number")
      .gt(0, "Amount must be greater than zero")
      .lte(10000000, "Amount is too large"),
    dueDate: z
      .string()
      .trim()
      .refine(isValidISODate, "Due date must be a real date in YYYY-MM-DD format")
      .optional(),
  })
  .refine((value) => (value.customerId !== undefined) !== (value.newCustomerName !== undefined), {
    message: "Provide exactly one of customerId or newCustomerName",
    path: ["customerId"],
  });

export type AssistantConfirmInput = z.infer<typeof assistantConfirmSchema>;
