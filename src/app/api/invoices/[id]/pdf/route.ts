import { jsonResponse, serviceErrorResponse } from "@/lib/api/respond";
import { prisma } from "@/lib/db/client";
import { renderInvoicePdf } from "@/lib/pdf/render-invoice";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { ServiceError } from "@/lib/services/errors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// Single-business app: the business profile row is keyed by this id (see api/business/route.ts).
const BUSINESS_ID = "local-business";

const PDF_FAILED_MESSAGE = "We could not create the PDF. Please try again.";

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const detail = await getInvoiceDetail(id);

    const profile = await prisma.businessProfile.findUnique({ where: { id: BUSINESS_ID } });
    if (!profile) {
      throw new ServiceError(
        "DOMAIN_RULE",
        "Set up your business details before creating invoice PDFs",
      );
    }

    const buffer = await renderInvoicePdf({
      ...detail,
      business: {
        businessName: profile.businessName,
        ownerName: profile.ownerName,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
      },
    });

    const safeName = detail.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "_");

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return serviceErrorResponse(error);
    }
    console.error("Invoice PDF generation failed");
    return jsonResponse(
      { success: false, error: { code: "PDF_FAILED", message: PDF_FAILED_MESSAGE } },
      500,
    );
  }
}
