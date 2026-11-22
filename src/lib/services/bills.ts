import { Prisma, type Bill, type BillOccurrence } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { todayKolkata } from "@/lib/financial/dates";
import { formatINR } from "@/lib/financial/money";
import {
  addDaysISO,
  classifyOccurrence,
  dueSoon,
  occurrencesInRange,
  type OccurrenceStatus,
} from "@/lib/financial/bills";
import type { BillInput, BillPatchInput, BillPayOccurrenceInput } from "@/lib/schemas/bills";
import { notFound, ServiceError } from "@/lib/services/errors";

type Tx = Prisma.TransactionClient;

/** Look-back window used for overdue totals in the summary. */
const OVERDUE_LOOKBACK_DAYS = 365;

export type BillOccurrenceRow = {
  billId: string;
  title: string;
  category: string;
  dueDate: string;
  amountPaise: number;
  paidDate: string | null;
  status: OccurrenceStatus;
  dueSoon: boolean;
};

type ScheduleBill = Pick<
  Bill,
  "id" | "title" | "category" | "defaultAmountPaise" | "firstDueDate" | "recurrence" | "archivedOn"
>;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function occurrenceKey(billId: string, dueDate: string): string {
  return `${billId}|${dueDate}`;
}

function indexPersisted(rows: BillOccurrence[]): Map<string, BillOccurrence> {
  const map = new Map<string, BillOccurrence>();
  for (const row of rows) {
    map.set(occurrenceKey(row.billId, row.dueDate), row);
  }
  return map;
}

/**
 * Materialises occurrences for one bill over [from, to] and overlays persisted payment rows.
 * Amount is the persisted amount when a row exists, otherwise the bill default.
 */
function buildRows(
  bill: ScheduleBill,
  persisted: Map<string, BillOccurrence>,
  from: string,
  to: string,
  today: string,
): BillOccurrenceRow[] {
  return occurrencesInRange(bill, from, to).map((dueDate) => {
    const row = persisted.get(occurrenceKey(bill.id, dueDate));
    const paidDate = row?.paidDate ?? null;
    const status = classifyOccurrence(dueDate, paidDate, today);
    return {
      billId: bill.id,
      title: bill.title,
      category: bill.category,
      dueDate,
      amountPaise: row?.amountPaise ?? bill.defaultAmountPaise,
      paidDate,
      status,
      dueSoon: status !== "PAID" && dueSoon(dueDate, today),
    };
  });
}

function compareRows(a: BillOccurrenceRow, b: BillOccurrenceRow): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export async function createBill(input: BillInput) {
  return prisma.bill.create({
    data: {
      title: input.title,
      category: input.category,
      defaultAmountPaise: input.defaultAmountPaise,
      firstDueDate: input.firstDueDate,
      recurrence: input.recurrence,
      notes: input.notes ?? null,
    },
  });
}

/**
 * Edits a bill. Paid occurrences are never rewritten. If the schedule (firstDueDate or recurrence)
 * changes, every paid occurrence must still be a valid occurrence under the new schedule; otherwise
 * the edit is refused (422) so payment history is not orphaned. Unpaid occurrences are not stored,
 * so they simply follow the new schedule and default amount.
 */
export async function updateBill(id: string, patch: BillPatchInput) {
  const today = todayKolkata();
  return prisma.$transaction(async (tx: Tx) => {
    const bill = await tx.bill.findUnique({ where: { id } });
    if (!bill) {
      throw notFound("Bill");
    }

    if (patch.firstDueDate !== undefined || patch.recurrence !== undefined) {
      const next = {
        firstDueDate: patch.firstDueDate ?? bill.firstDueDate,
        recurrence: patch.recurrence ?? bill.recurrence,
        archivedOn: bill.archivedOn,
      };
      const paid = await tx.billOccurrence.findMany({
        where: { billId: id, paidDate: { not: null } },
        select: { dueDate: true },
      });
      const allStillValid = paid.every(
        (row) => occurrencesInRange(next, row.dueDate, row.dueDate).length === 1,
      );
      if (!allStillValid) {
        throw new ServiceError(
          "DOMAIN_RULE",
          "This change would move bill dates that are already paid. Paid occurrences cannot be moved.",
        );
      }
    }

    const data: Prisma.BillUncheckedUpdateInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.defaultAmountPaise !== undefined) data.defaultAmountPaise = patch.defaultAmountPaise;
    if (patch.firstDueDate !== undefined) data.firstDueDate = patch.firstDueDate;
    if (patch.recurrence !== undefined) data.recurrence = patch.recurrence;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.archived === true && bill.archivedOn === null) data.archivedOn = today;
    if (patch.archived === false) data.archivedOn = null;

    return tx.bill.update({ where: { id }, data });
  });
}

/**
 * Archives a bill by setting archivedOn to today. Never deletes. Already-archived bills are returned unchanged.
 */
export async function archiveBill(id: string) {
  const today = todayKolkata();
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) {
    throw notFound("Bill");
  }
  if (bill.archivedOn !== null) {
    return bill;
  }
  return prisma.bill.update({ where: { id }, data: { archivedOn: today } });
}

/**
 * Occurrences of all bills over [from, to], sorted by due date. Status and dueSoon are computed
 * against Kolkata today.
 */
export async function listBillOccurrences(
  range: { from: string; to: string },
  status?: OccurrenceStatus,
): Promise<BillOccurrenceRow[]> {
  const { from, to } = range;
  const today = todayKolkata();
  if (from > to) {
    return [];
  }

  const bills = await prisma.bill.findMany({
    where: { firstDueDate: { lte: to } },
  });
  if (bills.length === 0) {
    return [];
  }

  const persistedRows = await prisma.billOccurrence.findMany({
    where: {
      billId: { in: bills.map((bill) => bill.id) },
      dueDate: { gte: from, lte: to },
    },
  });
  const persisted = indexPersisted(persistedRows);

  const rows = bills.flatMap((bill) => buildRows(bill, persisted, from, to, today));
  return rows.filter((row) => status === undefined || row.status === status).sort(compareRows);
}

/**
 * One bill with its occurrences over [from, to].
 */
export async function getBillDetail(id: string, range: { from: string; to: string }) {
  const today = todayKolkata();
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (!bill) {
    throw notFound("Bill");
  }
  const persistedRows = await prisma.billOccurrence.findMany({
    where: { billId: id, dueDate: { gte: range.from, lte: range.to } },
  });
  const occurrences = buildRows(bill, indexPersisted(persistedRows), range.from, range.to, today);
  return { ...bill, occurrences };
}

/**
 * Records full payment of one occurrence. Runs in a single transaction.
 * - Bill must exist and must not have been archived on or before dueDate (422).
 * - dueDate must be a real occurrence of the bill (404).
 * - Already paid: 409 CONFLICT.
 * - A supplied amount must equal the occurrence amount (422); partial payment is not supported.
 * - paidDate must not be after today in Kolkata (422).
 * The (billId, dueDate) unique constraint is the final guard against duplicate rows.
 */
export async function payOccurrence(billId: string, dueDate: string, input: BillPayOccurrenceInput) {
  const today = todayKolkata();
  if (input.paidDate > today) {
    throw new ServiceError("DOMAIN_RULE", "Paid date cannot be in the future");
  }

  try {
    return await prisma.$transaction(async (tx: Tx): Promise<BillOccurrence> => {
      const bill = await tx.bill.findUnique({ where: { id: billId } });
      if (!bill) {
        throw notFound("Bill");
      }
      if (bill.archivedOn !== null && bill.archivedOn <= dueDate) {
        throw new ServiceError(
          "DOMAIN_RULE",
          "This bill was archived on or before this due date and cannot be paid",
        );
      }

      const isOccurrence = occurrencesInRange(bill, bill.firstDueDate, dueDate).includes(dueDate);
      if (!isOccurrence) {
        throw notFound("Bill occurrence");
      }

      const existing = await tx.billOccurrence.findUnique({
        where: { billId_dueDate: { billId, dueDate } },
      });
      if (existing?.paidDate) {
        throw new ServiceError("CONFLICT", "This bill is already marked paid");
      }

      const occurrenceAmount = existing?.amountPaise ?? bill.defaultAmountPaise;
      if (input.amountPaise !== undefined && input.amountPaise !== occurrenceAmount) {
        throw new ServiceError(
          "DOMAIN_RULE",
          `Partial payments are not supported. Pay the full amount of ${formatINR(occurrenceAmount)}.`,
        );
      }

      return tx.billOccurrence.upsert({
        where: { billId_dueDate: { billId, dueDate } },
        create: { billId, dueDate, amountPaise: occurrenceAmount, paidDate: input.paidDate },
        update: { paidDate: input.paidDate, amountPaise: occurrenceAmount },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ServiceError("CONFLICT", "This bill is already marked paid");
    }
    throw error;
  }
}

/**
 * Unpaid occurrences from today through today + days (inclusive). Overdue items are not included
 * because the window starts today.
 */
export async function listUpcomingUnpaid(today: string, days: number): Promise<BillOccurrenceRow[]> {
  const rows = await listBillOccurrences({ from: today, to: addDaysISO(today, days) });
  return rows.filter((row) => row.status !== "PAID");
}

type Bucket = { count: number; amountPaise: number };

function emptyBucket(): Bucket {
  return { count: 0, amountPaise: 0 };
}

function addToBucket(bucket: Bucket, row: BillOccurrenceRow): void {
  bucket.count += 1;
  bucket.amountPaise += row.amountPaise;
}

/**
 * Totals for the bills page. Overdue looks back OVERDUE_LOOKBACK_DAYS; upcoming buckets look forward.
 */
export async function getBillsSummary() {
  const today = todayKolkata();
  const [activeCount, overdueRows, next7Rows, next30Rows] = await Promise.all([
    prisma.bill.count({ where: { archivedOn: null } }),
    listBillOccurrences({ from: addDaysISO(today, -OVERDUE_LOOKBACK_DAYS), to: addDaysISO(today, -1) }),
    listUpcomingUnpaid(today, 7),
    listUpcomingUnpaid(today, 30),
  ]);

  const overdue = emptyBucket();
  for (const row of overdueRows) {
    if (row.status === "OVERDUE") addToBucket(overdue, row);
  }
  const dueNext7Days = emptyBucket();
  for (const row of next7Rows) addToBucket(dueNext7Days, row);
  const dueNext30Days = emptyBucket();
  for (const row of next30Rows) addToBucket(dueNext30Days, row);

  return {
    activeBillCount: activeCount,
    overdue,
    dueNext7Days,
    dueNext30Days,
  };
}
