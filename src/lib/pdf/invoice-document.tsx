import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type InvoicePdfItem = {
  description: string;
  quantityMilli: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type InvoicePdfPayment = {
  amountPaise: number;
  paymentDate: string;
  method: string;
  referenceNumber: string | null;
};

export type InvoicePdfData = {
  lifecycle: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  paymentInstructions: string | null;
  business: {
    businessName: string;
    ownerName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  customer: {
    name: string;
    companyName: string | null;
  };
  items: InvoicePdfItem[];
  payments: InvoicePdfPayment[];
  totals: {
    totalPaise: number;
    paidPaise: number;
    outstandingPaise: number;
  };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a YYYY-MM-DD string as "10 Nov 2026". Parses the string directly so the
 * local timezone never shifts the calendar date.
 */
export function formatPdfDate(isoDate: string): string {
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

function formatQuantity(quantityMilli: number): string {
  return (quantityMilli / 1000).toString();
}

/**
 * Formats integer paise for the PDF as "Rs. 1,500.00" (Indian digit grouping, always
 * two decimals). Uses ASCII only because Helvetica's WinAnsi encoding has no rupee glyph.
 */
function pdfMoney(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("Paise amount must be a safe integer");
  }
  const negative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainder = absPaise % 100;
  const digits = rupees.toString();
  const grouped =
    digits.length <= 3
      ? digits
      : `${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${digits.slice(-3)}`;
  return `${negative ? "-" : ""}Rs. ${grouped}.${remainder.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  watermark: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 40,
    color: "#e5e7eb",
    transform: "rotate(-30deg)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  businessName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  muted: {
    color: "#4b5563",
    marginBottom: 2,
  },
  invoiceTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 4,
  },
  metaLine: {
    textAlign: "right",
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 4,
  },
  block: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#d1d5db",
    paddingVertical: 4,
  },
  colDescription: { flex: 4 },
  colNumber: { flex: 1.5, textAlign: "right" },
  colQty: { flex: 1, textAlign: "right" },
  totalsBlock: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    fontSize: 12,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    paddingTop: 4,
    marginTop: 4,
  },
  paymentRow: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  paymentDate: { flex: 2 },
  paymentMethod: { flex: 2 },
  paymentReference: { flex: 3 },
  paymentAmount: { flex: 2, textAlign: "right" },
  bodyText: {
    lineHeight: 1.4,
  },
});

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const isDraft = data.lifecycle === "DRAFT";
  const { business, customer, totals } = data;

  return (
    <Document title={`Invoice ${data.invoiceNumber}`} author={business.businessName}>
      <Page size="A4" style={styles.page}>
        {isDraft ? <Text style={styles.watermark}>DRAFT — not issued</Text> : null}

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.businessName}>{business.businessName}</Text>
            <Text style={styles.muted}>{business.ownerName}</Text>
            {business.email ? <Text style={styles.muted}>{business.email}</Text> : null}
            {business.phone ? <Text style={styles.muted}>{business.phone}</Text> : null}
            {business.address ? <Text style={styles.muted}>{business.address}</Text> : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.metaLine}>{data.invoiceNumber}</Text>
            <Text style={styles.metaLine}>Issue date: {formatPdfDate(data.issueDate)}</Text>
            <Text style={styles.metaLine}>Due date: {formatPdfDate(data.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Bill to</Text>
          <Text>{customer.name}</Text>
          {customer.companyName ? <Text>{customer.companyName}</Text> : null}
        </View>

        <View style={styles.block}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colNumber}>Unit price</Text>
            <Text style={styles.colNumber}>Line total</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{formatQuantity(item.quantityMilli)}</Text>
              <Text style={styles.colNumber}>{pdfMoney(item.unitPricePaise)}</Text>
              <Text style={styles.colNumber}>{pdfMoney(item.lineTotalPaise)}</Text>
            </View>
          ))}

          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text>Total</Text>
              <Text>{pdfMoney(totals.totalPaise)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>Amount paid</Text>
              <Text>{pdfMoney(totals.paidPaise)}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text>Balance due</Text>
              <Text>{pdfMoney(totals.outstandingPaise)}</Text>
            </View>
          </View>
        </View>

        {data.payments.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Payments received</Text>
            {data.payments.map((payment, index) => (
              <View key={index} style={styles.paymentRow} wrap={false}>
                <Text style={styles.paymentDate}>{formatPdfDate(payment.paymentDate)}</Text>
                <Text style={styles.paymentMethod}>{payment.method}</Text>
                <Text style={styles.paymentReference}>{payment.referenceNumber ?? "—"}</Text>
                <Text style={styles.paymentAmount}>{pdfMoney(payment.amountPaise)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.paymentInstructions ? (
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Payment instructions</Text>
            <Text style={styles.bodyText}>{data.paymentInstructions}</Text>
          </View>
        ) : null}

        {data.notes ? (
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.bodyText}>{data.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
