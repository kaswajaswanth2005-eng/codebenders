import { writeFileSync } from "node:fs";
import { renderInvoicePdf } from "../../src/lib/pdf/render-invoice";
const buf = await renderInvoicePdf({ lifecycle: "ISSUED", invoiceNumber: "INV-0001", issueDate: "2026-01-10", dueDate: "2026-02-10", notes: null, paymentInstructions: null, business: { businessName: "Test Biz", ownerName: "Owner", email: null, phone: null, address: null }, customer: { name: "Acme", companyName: null }, items: [{ description: "Service", quantityMilli: 1000, unitPricePaise: 150000, lineTotalPaise: 150000 }], payments: [{ amountPaise: 50000, paymentDate: "2026-01-15", method: "CASH", referenceNumber: null }] } as any);
writeFileSync(process.env.TEMP + "/invoice-test.pdf", buf);
console.log("bytes", buf.length, "head", buf.subarray(0, 4).toString("latin1"));
