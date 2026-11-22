// .codebenders/scratch/pdf-entry-live.ts
import { writeFileSync } from "node:fs";

// src/lib/pdf/render-invoice.ts
import { renderToBuffer } from "@react-pdf/renderer";

// src/lib/pdf/invoice-document.tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { jsx, jsxs } from "react/jsx-runtime";
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatPdfDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return isoDate;
  }
  return `${Number(match[3])} ${MONTHS[month - 1]} ${match[1]}`;
}
function formatQuantity(quantityMilli) {
  return (quantityMilli / 1e3).toString();
}
function pdfMoney(paise) {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("Paise amount must be a safe integer");
  }
  const negative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainder = absPaise % 100;
  const digits = rupees.toString();
  const grouped = digits.length <= 3 ? digits : `${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${digits.slice(-3)}`;
  return `${negative ? "-" : ""}Rs. ${grouped}.${remainder.toString().padStart(2, "0")}`;
}
var styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827"
  },
  watermark: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 40,
    color: "#e5e7eb",
    transform: "rotate(-30deg)"
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24
  },
  businessName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4
  },
  muted: {
    color: "#4b5563",
    marginBottom: 2
  },
  invoiceTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 4
  },
  metaLine: {
    textAlign: "right",
    marginBottom: 2
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 4
  },
  block: {
    marginBottom: 20
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold"
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#d1d5db",
    paddingVertical: 4
  },
  colDescription: { flex: 4 },
  colNumber: { flex: 1.5, textAlign: "right" },
  colQty: { flex: 1, textAlign: "right" },
  totalsBlock: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: 220
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    fontSize: 12,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    paddingTop: 4,
    marginTop: 4
  },
  paymentRow: {
    flexDirection: "row",
    paddingVertical: 2
  },
  paymentDate: { flex: 2 },
  paymentMethod: { flex: 2 },
  paymentReference: { flex: 3 },
  paymentAmount: { flex: 2, textAlign: "right" },
  bodyText: {
    lineHeight: 1.4
  }
});
function InvoiceDocument({ data }) {
  const isDraft = data.lifecycle === "DRAFT";
  const { business, customer, totals } = data;
  return /* @__PURE__ */ jsx(Document, { title: `Invoice ${data.invoiceNumber}`, author: business.businessName, children: /* @__PURE__ */ jsxs(Page, { size: "A4", style: styles.page, children: [
    isDraft ? /* @__PURE__ */ jsx(Text, { style: styles.watermark, children: "DRAFT \u2014 not issued" }) : null,
    /* @__PURE__ */ jsxs(View, { style: styles.headerRow, children: [
      /* @__PURE__ */ jsxs(View, { children: [
        /* @__PURE__ */ jsx(Text, { style: styles.businessName, children: business.businessName }),
        /* @__PURE__ */ jsx(Text, { style: styles.muted, children: business.ownerName }),
        business.email ? /* @__PURE__ */ jsx(Text, { style: styles.muted, children: business.email }) : null,
        business.phone ? /* @__PURE__ */ jsx(Text, { style: styles.muted, children: business.phone }) : null,
        business.address ? /* @__PURE__ */ jsx(Text, { style: styles.muted, children: business.address }) : null
      ] }),
      /* @__PURE__ */ jsxs(View, { children: [
        /* @__PURE__ */ jsx(Text, { style: styles.invoiceTitle, children: "INVOICE" }),
        /* @__PURE__ */ jsx(Text, { style: styles.metaLine, children: data.invoiceNumber }),
        /* @__PURE__ */ jsxs(Text, { style: styles.metaLine, children: [
          "Issue date: ",
          formatPdfDate(data.issueDate)
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.metaLine, children: [
          "Due date: ",
          formatPdfDate(data.dueDate)
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(View, { style: styles.block, children: [
      /* @__PURE__ */ jsx(Text, { style: styles.sectionLabel, children: "Bill to" }),
      /* @__PURE__ */ jsx(Text, { children: customer.name }),
      customer.companyName ? /* @__PURE__ */ jsx(Text, { children: customer.companyName }) : null
    ] }),
    /* @__PURE__ */ jsxs(View, { style: styles.block, children: [
      /* @__PURE__ */ jsxs(View, { style: styles.tableHeader, children: [
        /* @__PURE__ */ jsx(Text, { style: styles.colDescription, children: "Description" }),
        /* @__PURE__ */ jsx(Text, { style: styles.colQty, children: "Qty" }),
        /* @__PURE__ */ jsx(Text, { style: styles.colNumber, children: "Unit price" }),
        /* @__PURE__ */ jsx(Text, { style: styles.colNumber, children: "Line total" })
      ] }),
      data.items.map((item, index) => /* @__PURE__ */ jsxs(View, { style: styles.tableRow, wrap: false, children: [
        /* @__PURE__ */ jsx(Text, { style: styles.colDescription, children: item.description }),
        /* @__PURE__ */ jsx(Text, { style: styles.colQty, children: formatQuantity(item.quantityMilli) }),
        /* @__PURE__ */ jsx(Text, { style: styles.colNumber, children: pdfMoney(item.unitPricePaise) }),
        /* @__PURE__ */ jsx(Text, { style: styles.colNumber, children: pdfMoney(item.lineTotalPaise) })
      ] }, index)),
      /* @__PURE__ */ jsxs(View, { style: styles.totalsBlock, children: [
        /* @__PURE__ */ jsxs(View, { style: styles.totalsRow, children: [
          /* @__PURE__ */ jsx(Text, { children: "Total" }),
          /* @__PURE__ */ jsx(Text, { children: pdfMoney(totals.totalPaise) })
        ] }),
        /* @__PURE__ */ jsxs(View, { style: styles.totalsRow, children: [
          /* @__PURE__ */ jsx(Text, { children: "Amount paid" }),
          /* @__PURE__ */ jsx(Text, { children: pdfMoney(totals.paidPaise) })
        ] }),
        /* @__PURE__ */ jsxs(View, { style: styles.balanceRow, children: [
          /* @__PURE__ */ jsx(Text, { children: "Balance due" }),
          /* @__PURE__ */ jsx(Text, { children: pdfMoney(totals.outstandingPaise) })
        ] })
      ] })
    ] }),
    data.payments.length > 0 ? /* @__PURE__ */ jsxs(View, { style: styles.block, children: [
      /* @__PURE__ */ jsx(Text, { style: styles.sectionLabel, children: "Payments received" }),
      data.payments.map((payment, index) => /* @__PURE__ */ jsxs(View, { style: styles.paymentRow, wrap: false, children: [
        /* @__PURE__ */ jsx(Text, { style: styles.paymentDate, children: formatPdfDate(payment.paymentDate) }),
        /* @__PURE__ */ jsx(Text, { style: styles.paymentMethod, children: payment.method }),
        /* @__PURE__ */ jsx(Text, { style: styles.paymentReference, children: payment.referenceNumber ?? "\u2014" }),
        /* @__PURE__ */ jsx(Text, { style: styles.paymentAmount, children: pdfMoney(payment.amountPaise) })
      ] }, index))
    ] }) : null,
    data.paymentInstructions ? /* @__PURE__ */ jsxs(View, { style: styles.block, children: [
      /* @__PURE__ */ jsx(Text, { style: styles.sectionLabel, children: "Payment instructions" }),
      /* @__PURE__ */ jsx(Text, { style: styles.bodyText, children: data.paymentInstructions })
    ] }) : null,
    data.notes ? /* @__PURE__ */ jsxs(View, { style: styles.block, children: [
      /* @__PURE__ */ jsx(Text, { style: styles.sectionLabel, children: "Notes" }),
      /* @__PURE__ */ jsx(Text, { style: styles.bodyText, children: data.notes })
    ] }) : null
  ] }) });
}

// src/lib/financial/invoices.ts
var MS_PER_DAY = 24 * 60 * 60 * 1e3;
function assertSafe(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}
function invoiceTotalPaise(items) {
  let total = 0;
  for (const item of items) {
    assertSafe(item.lineTotalPaise, "Line total");
    total += item.lineTotalPaise;
    assertSafe(total, "Invoice total");
  }
  return total;
}
function paidTotalPaise(payments) {
  let total = 0;
  for (const payment of payments) {
    assertSafe(payment.amountPaise, "Payment amount");
    total += payment.amountPaise;
    assertSafe(total, "Paid total");
  }
  return total;
}
function outstandingPaise(totalPaise, paidPaise) {
  return Math.max(0, totalPaise - paidPaise);
}

// src/lib/pdf/render-invoice.ts
async function renderInvoicePdf(detail) {
  const totalPaise = invoiceTotalPaise(detail.items);
  const paidPaise = paidTotalPaise(detail.payments);
  const data = {
    lifecycle: detail.lifecycle,
    invoiceNumber: detail.invoiceNumber,
    issueDate: detail.issueDate,
    dueDate: detail.dueDate,
    notes: detail.notes,
    paymentInstructions: detail.paymentInstructions,
    business: detail.business,
    customer: detail.customer,
    items: detail.items.map((item) => ({ ...item })),
    payments: detail.payments.map((payment) => ({ ...payment })),
    totals: {
      totalPaise,
      paidPaise,
      outstandingPaise: outstandingPaise(totalPaise, paidPaise)
    }
  };
  return renderToBuffer(InvoiceDocument({ data }));
}

// .codebenders/scratch/pdf-entry-live.ts
var buf = await renderInvoicePdf({ lifecycle: "ISSUED", invoiceNumber: "INV-0001", issueDate: "2026-01-10", dueDate: "2026-02-10", notes: null, paymentInstructions: null, business: { businessName: "Test Biz", ownerName: "Owner", email: null, phone: null, address: null }, customer: { name: "Acme", companyName: null }, items: [{ description: "Service", quantityMilli: 1e3, unitPricePaise: 15e4, lineTotalPaise: 15e4 }], payments: [{ amountPaise: 5e4, paymentDate: "2026-01-15", method: "CASH", referenceNumber: null }] });
writeFileSync(process.env.TEMP + "/invoice-test.pdf", buf);
console.log("bytes", buf.length, "head", buf.subarray(0, 4).toString("latin1"));
