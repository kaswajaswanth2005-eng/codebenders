import { z } from "zod";

const assistantHistoryEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

export const assistantQuerySchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, "Ask a financial question using at least 3 characters")
    .max(1000, "Question must be 1,000 characters or fewer"),
  history: z.array(assistantHistoryEntrySchema).max(10).optional(),
});

export type AssistantHistoryEntry = z.infer<typeof assistantHistoryEntrySchema>;

export const assistantConsentSchema = z.object({
  consent: z.boolean({ invalid_type_error: "Consent must be true or false" }),
});
