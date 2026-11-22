import { z } from "zod";
import { isValidISODate, todayKolkata } from "@/lib/financial/dates";
import { rupeesToPaise } from "@/lib/financial/money";

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional();

export const businessInputSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Business name is required")
    .max(120, "Business name must be 120 characters or fewer"),
  ownerName: z
    .string()
    .trim()
    .min(1, "Owner name is required")
    .max(120, "Owner name must be 120 characters or fewer"),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.string().email().safeParse(value).success, {
      message: "Enter a valid email address",
    })
    .optional()
    .transform((value) => (value === "" || value === undefined ? undefined : value)),
  phone: optionalTrimmed(30, "Phone"),
  address: optionalTrimmed(300, "Address"),
  openingCashRupees: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? undefined : trimmed;
      }
      return value;
    },
    z.coerce
      .number({ invalid_type_error: "Enter a valid amount" })
      .finite("Enter a valid amount")
      .min(0, "Opening cash cannot be negative")
      .max(100000000000, "Opening cash is too large"),
  ),
  openingCashDate: z
    .string()
    .trim()
    .refine(isValidISODate, { message: "Enter a valid date" })
    .refine((value) => value <= todayKolkata(), {
      message: "Opening cash date cannot be in the future",
    }),
  paymentInstructions: optionalTrimmed(1000, "Payment instructions"),
});

export type BusinessInput = z.infer<typeof businessInputSchema>;

export function toBusinessWriteData(input: BusinessInput) {
  return {
    businessName: input.businessName,
    ownerName: input.ownerName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    openingCashPaise: rupeesToPaise(input.openingCashRupees),
    openingCashDate: input.openingCashDate,
    paymentInstructions: input.paymentInstructions ?? null,
  };
}
