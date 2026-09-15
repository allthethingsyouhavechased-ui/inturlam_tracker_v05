// Stok / hedef raporunun Excel dökümü:
// /social/rapor/export[?brand=ID][&kind=Post|Story|Reels][&missing=1]
//
// Ekran ile AYNI saf hesabı (lib/socialStock.ts) çağırıyor — iki yerde ayrı
// hesaplanırsa "Excel başka söylüyor" durumu kaçınılmaz olurdu.
// Route handler: `lib/xlsx.ts` node:zlib kullanıyor, istemci paketine girmesin.

import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/identity";
import { todayISO } from "@/lib/date";
import { CONTENT_KINDS, CONTENT_KIND_LABEL, isContentKind } from "@/lib/socialPlan";
import { ratioLabel, stockRow, stockTotals } from "@/lib/socialStock";
import { lastAssetUpdateByBrand, listBrandVarlikRows } from "@/lib/repositories/socialPlan";
import { buildXlsx, xlsxFileName } from "@/lib/xlsx";
import type { ContentKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Mevcut sosyal bölüm yetkisi korunuyor: ekip oturumu yeterli, guest değil.
  const actor = await getCurrentActor();
  if (!actor || actor.kind !== "team") {
    return NextResponse.json({ error: "Bu döküm için ekip hesabı gerekli." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const brandFilter = params.get("brand")?.trim() ?? "";
  const kindParam = params.get("kind")?.trim() ?? "";
  const kind: ContentKind | null = isContentKind(kindParam) ? kindParam : null;
  const onlyMissing = params.get("missing") === "1";

  const month = todayISO().slice(0, 7);
  const lastUpdates = lastAssetUpdateByBrand();
  const kinds = kind ? [kind] : CONTENT_KINDS;
  const rows = listBrandVarlikRows(month)
    .map((row) => stockRow(row, kinds))
    .filter((row) => (!brandFilter || row.brand_id === brandFilter))
    .filter((row) => (!onlyMissing || row.totalMissing > 0));
  const totals = stockTotals(rows);

  const sheet = {
    name: "Stok ve hedef",
    columns: [
      { header: "Marka", width: 28 },
      { header: "Tür", width: 10 },
      { header: "Hazır stok", width: 12 },
      { header: "Aylık hedef", width: 12 },
      { header: "Eksik", width: 10 },
      { header: "Fazla", width: 10 },
      { header: "Oran", width: 18 },
      { header: "Aylık teslim", width: 16 },
      { header: "Son stok güncellemesi", width: 22 },
    ],
    rows: [
      ...rows.flatMap((row) =>
        row.cells.map((cell) => [
          row.brand_name,
          CONTENT_KIND_LABEL[cell.kind],
          cell.ready,
          cell.target,
          cell.missing,
          cell.surplus,
          ratioLabel(cell.ratio),
          row.monthly_content_completed ? "Tamamlandı" : "Açık",
          lastUpdates.get(row.brand_id) ?? "Hiç girilmedi",
        ]),
      ),
      [
        "Portföy toplamı", "", totals.ready, totals.target, totals.missing, totals.surplus,
        "Toplam eksik marka eksiklerinin toplamıdır", "", "",
      ],
    ],
    boldRows: [rows.reduce((sum, row) => sum + row.cells.length, 0)],
  };

  const buffer = buildXlsx([sheet]);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${xlsxFileName(["stok-hedef", month])}"`,
    },
  });
}
