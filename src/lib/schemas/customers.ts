import { z } from "zod";

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .transform((value) => (value === "" || value === undefined ? undefined : value));

export const customerInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(120, "Customer name must be 120 characters or fewer"),
  companyName: optionalTrimmed(120, "Company name"),
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
  notes: optionalTrimmed(2000, "Notes"),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;
