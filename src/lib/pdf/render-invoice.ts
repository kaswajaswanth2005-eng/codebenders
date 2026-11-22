import { renderToBuffer } from "@react-pdf/renderer";
import {
  InvoiceDocument,
  type InvoicePdfData,
} from "@/lib/pdf/invoice-document";
import {
  invoiceTotalPaise,
  outstandingPaise,
  paidTotalPaise,
} from "@/lib/financial/invoices";

export type InvoicePdfSource = {
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
  items: ReadonlyArray<{
    description: string;
    quantityMilli: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>;
  payments: ReadonlyArray<{
    amountPaise: number;
    paymentDate: string;
    method: string;
    referenceNumber: string | null;
  }>;
};

/**
 * Renders an invoice to PDF bytes. Totals are recomputed from the stored items and
 * payments, never taken from stored sums.
 */
export async function renderInvoicePdf(detail: InvoicePdfSource): Promise<Buffer> {
  const totalPaise = invoiceTotalPaise(detail.items);
  const paidPaise = paidTotalPaise(detail.payments);

  const data: InvoicePdfData = {
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
      outstandingPaise: outstandingPaise(totalPaise, paidPaise),
    },
  };

  // InvoiceDocument returns a <Document> root typed as JSX.Element (ReactElement<any>),
  // which renderToBuffer accepts directly. Calling it (no hooks) avoids the
  // FunctionComponentElement<{data}> mismatch with ReactElement<DocumentProps>.
  return renderToBuffer(InvoiceDocument({ data }));
}
