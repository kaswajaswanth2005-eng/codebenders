import { PrismaClient } from "@prisma/client";
import { todayKolkata } from "../src/lib/financial/dates";
import { addDaysISO } from "../src/lib/financial/bills";

const prisma = new PrismaClient();

if (!process.argv.includes("--confirm")) {
  console.log("This deletes all local data. Re-run with --confirm.");
  process.exit(1);
}

const today = todayKolkata();
const d = (n: number) => addDaysISO(today, n);

type Lifecycle = "DRAFT" | "ISSUED";
type PaymentSeed = { amountPaise: number; paymentDate: string };

const CUSTOMERS: { name: string; slug: string }[] = [
  { name: "ABC Enterprises", slug: "abc-enterprises" },
  { name: "Blue Lotus Cafe", slug: "blue-lotus-cafe" },
  { name: "Nimbus Health", slug: "nimbus-health" },
  { name: "Greenleaf Realty", slug: "greenleaf-realty" },
  { name: "Pixel Fox Games", slug: "pixel-fox-games" },
  { name: "Sunrise Textiles", slug: "sunrise-textiles" },
  { name: "Orbit Education", slug: "orbit-education" },
];

const invoiceCounts = { invoices: 0, payments: 0 };

async function createInvoice(
  number: string,
  customerName: string,
  lifecycle: Lifecycle,
  issueDate: string,
  dueDate: string,
  expectedDate: string | null,
  amountPaise: number,
  payments: PaymentSeed[],
) {
  const paidSum = payments.reduce((s, p) => s + p.amountPaise, 0);
  if (paidSum > amountPaise) {
    throw new Error(`${number}: payments ${paidSum} exceed total ${amountPaise}`);
  }
  const customer = await prisma.customer.findFirstOrThrow({ where: { name: customerName } });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: number,
      customerId: customer.id,
      lifecycle,
      issueDate,
      dueDate,
      expectedCollectionDate: expectedDate,
      items: {
        create: [
          {
            description: "Design services",
            quantityMilli: 1000,
            unitPricePaise: amountPaise,
            lineTotalPaise: amountPaise,
          },
        ],
      },
    },
  });
  invoiceCounts.invoices += 1;

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amountPaise: p.amountPaise,
        method: i % 2 === 0 ? "UPI" : "BANK_TRANSFER",
        paymentDate: p.paymentDate,
        idempotencyKey: `seed-${number}-${i + 1}`,
      },
    });
    invoiceCounts.payments += 1;
  }
  return invoice;
}

async function main() {
  // Delete in dependency order.
  await prisma.invoicePayment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.billOccurrence.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.businessProfile.deleteMany();

  await prisma.businessProfile.create({
    data: {
      id: "local-business",
      businessName: "Creative Studio",
      ownerName: "Priya Sharma",
      email: "hello@creativestudio.example",
      phone: "+91 90000 00000",
      address: "12 Studio Lane, Bengaluru",
      currency: "INR",
      openingCashPaise: 2000000,
      openingCashDate: d(-30),
      paymentInstructions: "UPI: creativestudio@examplebank",
    },
  });

  for (const c of CUSTOMERS) {
    await prisma.customer.create({
      data: {
        name: c.name,
        email: `billing@${c.slug}.example`,
      },
    });
  }

  // INV-0001..INV-0012
  // 2 fully paid (two payments summing to total)
  await createInvoice("INV-0001", "Blue Lotus Cafe", "ISSUED", d(-45), d(-30), null, 1200000, [
    { amountPaise: 600000, paymentDate: d(-40) },
    { amountPaise: 600000, paymentDate: d(-35) },
  ]);
  await createInvoice("INV-0002", "Nimbus Health", "ISSUED", d(-25), d(-10), null, 800000, [
    { amountPaise: 300000, paymentDate: d(-20) },
    { amountPaise: 500000, paymentDate: d(-15) },
  ]);
  // 2 partially paid, not due
  await createInvoice("INV-0003", "Greenleaf Realty", "ISSUED", d(-5), d(15), null, 1000000, [
    { amountPaise: 400000, paymentDate: d(-3) },
  ]);
  await createInvoice("INV-0004", "Pixel Fox Games", "ISSUED", d(-4), d(8), null, 900000, [
    { amountPaise: 250000, paymentDate: d(-2) },
  ]);
  // 3 overdue unpaid, no expected collection date
  await createInvoice("INV-0005", "Sunrise Textiles", "ISSUED", d(-35), d(-5), null, 600000, []);
  await createInvoice("INV-0006", "Orbit Education", "ISSUED", d(-48), d(-18), null, 750000, []);
  await createInvoice("INV-0007", "Blue Lotus Cafe", "ISSUED", d(-70), d(-40), null, 550000, []);
  // 1 overdue with expected collection date
  await createInvoice("INV-0008", "Nimbus Health", "ISSUED", d(-30), d(-12), d(10), 680000, []);
  // 1 unpaid due in 2 days
  await createInvoice("INV-0009", "Greenleaf Realty", "ISSUED", d(-12), d(2), null, 920000, []);
  // 2 issued, not yet due, with expected collection dates
  await createInvoice("INV-0010", "Pixel Fox Games", "ISSUED", d(-2), d(20), d(12), 1100000, []);
  await createInvoice("INV-0011", "Sunrise Textiles", "ISSUED", d(-1), d(35), d(28), 1300000, []);
  // 1 draft, no payments
  await createInvoice("INV-0012", "Orbit Education", "DRAFT", d(0), d(30), null, 500000, []);

  // Canonical invoices
  await createInvoice("INV-0013", "ABC Enterprises", "ISSUED", d(-3), d(20), d(5), 4000000, []);
  await createInvoice("INV-0014", "Orbit Education", "ISSUED", d(-3), d(25), d(15), 2500000, []);

  // ABC Enterprises ISSUED 4000000 with one partial payment
  await createInvoice("INV-0015", "ABC Enterprises", "ISSUED", d(-12), d(-2), null, 4000000, [
    { amountPaise: 1500000, paymentDate: d(-10) },
  ]);

  // Bills (independent of business profile)
  const rent = await prisma.bill.create({
    data: {
      title: "Office rent",
      category: "Rent",
      recurrence: "MONTHLY",
      defaultAmountPaise: 3000000,
      firstDueDate: d(7),
    },
  });
  await prisma.bill.create({
    data: {
      title: "Salaries",
      category: "Salaries",
      recurrence: "MONTHLY",
      defaultAmountPaise: 9500000,
      firstDueDate: d(18),
    },
  });
  await prisma.bill.create({
    data: {
      title: "Adobe Creative Cloud",
      category: "Software",
      recurrence: "MONTHLY",
      defaultAmountPaise: 450000,
      firstDueDate: d(12),
    },
  });
  await prisma.bill.create({
    data: {
      title: "Internet and power",
      category: "Utilities",
      recurrence: "NONE",
      defaultAmountPaise: 320000,
      firstDueDate: d(9),
    },
  });
  await prisma.bill.create({
    data: {
      title: "Equipment lease",
      category: "Other",
      recurrence: "NONE",
      defaultAmountPaise: 6000000,
      firstDueDate: d(12),
      notes: "Fixed monthly lease, one-time entry for demo",
    },
  });

  await prisma.billOccurrence.create({
    data: {
      billId: rent.id,
      dueDate: d(-23),
      amountPaise: 3000000,
      paidDate: d(-23),
    },
  });

  const counts = {
    businessProfiles: await prisma.businessProfile.count(),
    customers: await prisma.customer.count(),
    invoices: await prisma.invoice.count(),
    invoicePayments: await prisma.invoicePayment.count(),
    bills: await prisma.bill.count(),
    billOccurrences: await prisma.billOccurrence.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
