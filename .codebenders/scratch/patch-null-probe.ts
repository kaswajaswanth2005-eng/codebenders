import { invoicePatchSchema } from "../../src/lib/schemas/invoices";
const cases: Record<string, unknown> = {
  notesNull: { notes: null },
  paymentInstructionsNull: { paymentInstructions: null },
  expectedCollectionDateNull: { expectedCollectionDate: null },
};
for (const [name, body] of Object.entries(cases)) {
  const r = invoicePatchSchema.safeParse(body);
  console.log(name, r.success ? "ACCEPTED" : "REJECTED: " + JSON.stringify(r.error.issues.map((i) => i.path.join(".") + ": " + i.message)));
}
