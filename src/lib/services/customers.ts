import { prisma } from "@/lib/db/client";
import { todayKolkata } from "@/lib/financial/dates";
import type { CustomerInput } from "@/lib/schemas/customers";
import { notFound } from "@/lib/services/errors";
import { deriveInvoiceFields, summarizeReceivables } from "@/lib/services/invoice-view";

const customerWriteData = (input: CustomerInput) => ({
  name: input.name,
  companyName: input.companyName ?? null,
  email: input.email ?? null,
  phone: input.phone ?? null,
  address: input.address ?? null,
  notes: input.notes ?? null,
});

const receivableInvoiceSelect = {
  lifecycle: true,
  dueDate: true,
  items: { select: { lineTotalPaise: true } },
  payments: { select: { amountPaise: true } },
} as const;

export async function createCustomer(input: CustomerInput) {
  return prisma.customer.create({ data: customerWriteData(input) });
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw notFound("Customer");
  }
  return prisma.customer.update({ where: { id }, data: customerWriteData(input) });
}

/**
 * Archives a customer. Customers are never hard-deleted.
 */
export async function archiveCustomer(id: string) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    throw notFound("Customer");
  }
  if (existing.archivedAt !== null) {
    return existing;
  }
  return prisma.customer.update({ where: { id }, data: { archivedAt: new Date() } });
}

export type ListCustomersOptions = { search?: string; includeArchived?: boolean };

export async function listCustomers(options: ListCustomersOptions = {}) {
  const search = options.search?.trim();
  const today = todayKolkata();
  const rows = await prisma.customer.findMany({
    where: {
      ...(options.includeArchived ? {} : { archivedAt: null }),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { companyName: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: { invoices: { select: receivableInvoiceSelect } },
  });

  return rows.map(({ invoices, ...customer }) => ({
    ...customer,
    summary: summarizeReceivables(invoices, today),
  }));
}

export async function getCustomerDetail(id: string) {
  const today = todayKolkata();
  const row = await prisma.customer.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: [{ dueDate: "asc" }, { invoiceNumber: "asc" }],
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });
  if (!row) {
    throw notFound("Customer");
  }

  const { invoices, ...customer } = row;
  const invoiceViews = invoices.map((invoice) => ({
    ...invoice,
    ...deriveInvoiceFields(invoice, today),
  }));
  const payments = invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => ({
      ...payment,
      invoiceNumber: invoice.invoiceNumber,
    })),
  );

  return {
    customer,
    invoices: invoiceViews,
    payments,
    summary: summarizeReceivables(invoices, today),
  };
}
