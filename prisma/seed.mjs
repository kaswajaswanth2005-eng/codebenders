import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const DEMO_CONFIRMATION = "--confirm-reset=CashPilotDemo";
const E2E_CONFIRMATION = "--confirm-reset=CashPilotE2E";
const isE2E = process.argv.includes(E2E_CONFIRMATION);
if (!process.argv.includes(DEMO_CONFIRMATION) && !isE2E) {
  console.error("Demo seeding replaces every CashPilot record in the configured database.");
  console.error(`Re-run with: npm run db:seed -- ${DEMO_CONFIRMATION}`);
  process.exit(1);
}

const prismaDir = path.dirname(fileURLToPath(import.meta.url));

async function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  try {
    const contents = await readFile(path.join(prismaDir, "..", ".env"), "utf8");
    const line = contents.split(/\r?\n/).find((candidate) => /^\s*DATABASE_URL\s*=/.test(candidate));
    if (line) {
      const value = line.slice(line.indexOf("=") + 1).trim().replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
      if (value) {
        process.env.DATABASE_URL = value;
        return value;
      }
    }
  } catch {
    // The explicit error below explains the required configuration.
  }
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env first.");
}

const databaseUrl = await loadDatabaseUrl();
if (!databaseUrl.startsWith("file:")) {
  throw new Error("Demo seeding supports only the local SQLite file configured by DATABASE_URL.");
}
const configuredPath = decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0]);
const databasePath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(prismaDir, configuredPath);
const prisma = new PrismaClient();

function dateInKolkata() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function line(description, amountPaise, sortOrder = 0) {
  return {
    description,
    quantityMilli: 1000,
    unitPricePaise: amountPaise,
    lineTotalPaise: amountPaise,
    sortOrder,
  };
}

async function backupDatabase() {
  if (isE2E) return null;
  try {
    await stat(databasePath);
  } catch {
    return null;
  }
  const backupDir = path.join(prismaDir, "backups");
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const databaseName = path.basename(databasePath, path.extname(databasePath)).replace(/[^A-Za-z0-9_-]/g, "_");
  const target = path.join(backupDir, `${databaseName}-before-demo-${stamp}.db`);
  await copyFile(databasePath, target);
  return target;
}

async function main() {
  const today = dateInKolkata();
  const backup = await backupDatabase();

  await prisma.$transaction(async (tx) => {
    await tx.invoicePayment.deleteMany();
    await tx.invoiceItem.deleteMany();
    await tx.invoice.deleteMany();
    await tx.billOccurrence.deleteMany();
    await tx.bill.deleteMany();
    await tx.customer.deleteMany();
    await tx.businessProfile.deleteMany();

    await tx.businessProfile.create({
      data: {
        id: "local-business",
        businessName: "Creative Studio Demo",
        ownerName: "Demo Owner",
        email: "owner@example.test",
        phone: "+91 90000 00000",
        address: "Bengaluru, Karnataka",
        currency: "INR",
        openingCashPaise: 2_000_000,
        openingCashDate: today,
        paymentInstructions: "Demo only — replace with your real payment instructions.",
      },
    });

    const customers = await Promise.all(
      [
        ["client-a", "Aurora Brands", "Aurora Brands Pvt Ltd"],
        ["client-b", "Bluebird Foods", "Bluebird Foods"],
        ["client-c", "Cedar Homes", "Cedar Homes LLP"],
        ["client-d", "Drift Coffee", "Drift Coffee Co"],
        ["client-e", "Ember Learning", "Ember Learning"],
        ["client-f", "Fieldnote Labs", "Fieldnote Labs"],
        ["client-g", "Greenline Retail", "Greenline Retail"],
      ].map(([id, name, companyName]) =>
        tx.customer.create({ data: { id, name, companyName, notes: "Fictional hackathon demo customer" } }),
      ),
    );
    const customerIds = new Set(customers.map((customer) => customer.id));

    async function createInvoice({
      id,
      number,
      customerId,
      lifecycle = "ISSUED",
      issueOffset,
      dueOffset,
      expectedOffset = null,
      totalPaise,
      paymentPaise = 0,
      paymentOffset = -1,
    }) {
      if (!customerIds.has(customerId)) throw new Error(`Unknown demo customer ${customerId}`);
      return tx.invoice.create({
        data: {
          id,
          invoiceNumber: number,
          customerId,
          lifecycle,
          issueDate: addDays(today, issueOffset),
          dueDate: addDays(today, dueOffset),
          expectedCollectionDate: expectedOffset === null ? null : addDays(today, expectedOffset),
          notes: "Fictional sample invoice for the CashPilot demo.",
          items: { create: [line("Graphic design services", totalPaise)] },
          payments:
            paymentPaise > 0
              ? {
                  create: {
                    amountPaise: paymentPaise,
                    paymentDate: addDays(today, paymentOffset),
                    method: "BANK_TRANSFER",
                    idempotencyKey: `demo-payment-${id}`,
                    referenceNumber: `DEMO-${number}`,
                  },
                }
              : undefined,
        },
      });
    }

    await createInvoice({ id: "invoice-a", number: "INV-0001", customerId: "client-a", issueOffset: -10, dueOffset: 5, expectedOffset: 5, totalPaise: 4_000_000 });
    await createInvoice({ id: "invoice-b", number: "INV-0002", customerId: "client-b", issueOffset: -8, dueOffset: 15, expectedOffset: 15, totalPaise: 2_500_000 });
    await createInvoice({ id: "invoice-c", number: "INV-0003", customerId: "client-c", issueOffset: -35, dueOffset: -12, totalPaise: 3_000_000, paymentPaise: 1_500_000, paymentOffset: -20 });
    await createInvoice({ id: "invoice-d", number: "INV-0004", customerId: "client-d", issueOffset: -25, dueOffset: -8, totalPaise: 1_800_000 });
    await createInvoice({ id: "invoice-e", number: "INV-0005", customerId: "client-e", issueOffset: -20, dueOffset: -4, totalPaise: 1_000_000 });
    await createInvoice({ id: "invoice-f", number: "INV-0006", customerId: "client-f", issueOffset: -60, dueOffset: -40, totalPaise: 2_000_000, paymentPaise: 2_000_000, paymentOffset: -35 });
    await createInvoice({ id: "invoice-g", number: "INV-0007", customerId: "client-g", issueOffset: -55, dueOffset: -30, totalPaise: 2_800_000, paymentPaise: 2_800_000, paymentOffset: -28 });
    await createInvoice({ id: "invoice-h", number: "INV-0008", customerId: "client-a", issueOffset: -45, dueOffset: -20, totalPaise: 2_200_000, paymentPaise: 2_200_000, paymentOffset: -18 });
    await createInvoice({ id: "invoice-i", number: "INV-0009", customerId: "client-b", issueOffset: -5, dueOffset: 40, expectedOffset: 40, totalPaise: 5_000_000, paymentPaise: 1_000_000, paymentOffset: -1 });
    await createInvoice({ id: "invoice-j", number: "INV-0010", customerId: "client-c", lifecycle: "DRAFT", issueOffset: 0, dueOffset: 14, totalPaise: 1_200_000 });
    await createInvoice({ id: "invoice-k", number: "INV-0011", customerId: "client-f", issueOffset: -2, dueOffset: 45, expectedOffset: 45, totalPaise: 3_500_000 });
    await createInvoice({ id: "invoice-l", number: "INV-0012", customerId: "client-g", lifecycle: "DRAFT", issueOffset: 0, dueOffset: 30, totalPaise: 900_000 });

    await tx.bill.createMany({
      data: [
        { id: "bill-rent", title: "Office rent", category: "Rent", defaultAmountPaise: 3_000_000, firstDueDate: addDays(today, 10), recurrence: "NONE", notes: "Canonical delay scenario" },
        { id: "bill-salaries", title: "Employee salaries", category: "Salaries", defaultAmountPaise: 4_500_000, firstDueDate: addDays(today, 20), recurrence: "NONE", notes: "Canonical delay scenario" },
        { id: "bill-marketing", title: "Campaign production", category: "Marketing", defaultAmountPaise: 1_500_000, firstDueDate: addDays(today, 26), recurrence: "NONE", notes: "Creates a visible baseline funding risk" },
        { id: "bill-software", title: "Design software", category: "Software", defaultAmountPaise: 240_000, firstDueDate: addDays(today, 35), recurrence: "MONTHLY", notes: "Monthly recurring demo bill" },
        { id: "bill-utilities", title: "Studio utilities", category: "Utilities", defaultAmountPaise: 180_000, firstDueDate: addDays(today, 42), recurrence: "MONTHLY", notes: "Monthly recurring demo bill" },
      ],
    });
  });

  console.log("CashPilot fictional demo data seeded successfully.");
  console.log("Customers: 7, invoices: 12, bills: 5.");
  if (backup) console.log(`Previous database backup: ${backup}`);
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
