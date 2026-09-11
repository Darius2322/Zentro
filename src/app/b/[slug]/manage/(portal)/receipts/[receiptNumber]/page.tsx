import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { serializeReceipt } from "@/lib/receipt";
import { ReceiptView } from "@/components/ReceiptView";

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string; receiptNumber: string };
  searchParams: { format?: string };
}) {
  const business = await resolveBusinessBySlug(params.slug);
  const receipt = await prisma.receipt.findFirst({
    where: { receiptNumber: params.receiptNumber, businessId: business.id },
    include: { booking: { include: { customer: true, staff: true } }, payment: true },
  });
  if (!receipt) notFound();

  const thermal = searchParams.format === "thermal";
  const data = serializeReceipt(receipt, business);

  return (
    <div>
      <div className="no-print btn-row" style={{ marginBottom: 20 }}>
        <Link className="btn btn-secondary btn-small" href={`/b/${params.slug}/manage/receipts`}>
          ← All receipts
        </Link>
        <Link
          className={`btn btn-small ${thermal ? "" : "btn-secondary"}`}
          href={`/b/${params.slug}/manage/receipts/${params.receiptNumber}?format=thermal`}
        >
          Thermal
        </Link>
        <Link
          className={`btn btn-small ${!thermal ? "" : "btn-secondary"}`}
          href={`/b/${params.slug}/manage/receipts/${params.receiptNumber}`}
        >
          Standard
        </Link>
      </div>
      <ReceiptView receipt={data} thermal={thermal} />
    </div>
  );
}
