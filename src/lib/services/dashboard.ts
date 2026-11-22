import { prisma } from "@/lib/db/client";
import { buildAlerts } from "@/lib/alerts/rules";
import { addDaysISO, dueSoon } from "@/lib/financial/bills";
import { todayKolkata } from "@/lib/financial/dates";
import { getForecast, type ForecastHorizon } from "@/lib/services/forecast";
import { listUpcomingUnpaid } from "@/lib/services/bills";
import { listInvoices } from "@/lib/services/invoices";
import { ServiceError } from "@/lib/services/errors";

const BUSINESS_PROFILE_ID = "local-business";

export async function getDashboardData(horizonDays: ForecastHorizon = 30) {
  const profile = await prisma.businessProfile.findUnique({
    where: { id: BUSINESS_PROFILE_ID },
    select: { businessName: true, openingCashPaise: true, openingCashDate: true },
  });
  if (!profile) {
    throw new ServiceError("NOT_FOUND", "Set up your business first");
  }

  const today = todayKolkata();
  const [invoiceRows, upcomingRows, forecast] = await Promise.all([
    listInvoices(),
    listUpcomingUnpaid(today, 30),
    getForecast(horizonDays),
  ]);

  const openRows = invoiceRows.filter(
    (row) => row.lifecycle === "ISSUED" && row.outstandingPaise > 0,
  );
  const overdueRows = openRows.filter((row) => row.overdue);
  const dueSoonRows = openRows.filter(
    (row) => !row.overdue && row.dueDate >= today && row.dueDate <= addDaysISO(today, 3),
  );
  const receivables = [...openRows].sort(
    (a, b) => b.overdueDays - a.overdueDays || b.outstandingPaise - a.outstandingPaise,
  );

  const totalOutstandingPaise = openRows.reduce((sum, row) => sum + row.outstandingPaise, 0);
  const overduePaise = overdueRows.reduce((sum, row) => sum + row.outstandingPaise, 0);
  const upcomingBillsPaise = upcomingRows.reduce((sum, row) => sum + row.amountPaise, 0);

  const alerts = buildAlerts({
    today,
    overdueInvoices: overdueRows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      customerName: row.customer.name,
      outstandingPaise: row.outstandingPaise,
      overdueDays: row.overdueDays,
    })),
    dueSoonInvoices: dueSoonRows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      customerName: row.customer.name,
      dueDate: row.dueDate,
      outstandingPaise: row.outstandingPaise,
    })),
    unpaidBills: upcomingRows.map((row) => ({
      billId: row.billId,
      title: row.title,
      dueDate: row.dueDate,
      amountPaise: row.amountPaise,
    })),
    pastDueBills: forecast.overdueBills,
    cashShortfall: forecast.firstShortfallDate
      ? { date: forecast.firstShortfallDate, minimumCashPaise: forecast.minimumCashPaise }
      : null,
  });

  return {
    today,
    profile,
    summary: {
      recordedCashPaise: forecast.recordedCashPaise,
      totalOutstandingPaise,
      overduePaise,
      upcomingBillsPaise,
      projectedCashPaise: forecast.endingCashPaise,
      openInvoiceCount: openRows.length,
      overdueInvoiceCount: overdueRows.length,
      upcomingBillCount: upcomingRows.length,
    },
    receivables,
    upcomingBills: upcomingRows.filter((row) => dueSoon(row.dueDate, today, 7)),
    upcomingBills30Days: upcomingRows,
    forecast,
    alerts,
  };
}
