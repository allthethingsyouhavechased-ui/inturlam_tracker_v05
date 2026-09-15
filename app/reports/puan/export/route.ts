// Kazanılmış puan dökümü: /reports/puan/export?month=YYYY-MM
//
// Ekran ile AYNI sorguları kullanıyor (lib/repositories/pointLedger.ts,
// pointPackages.ts) — ekran-Excel eşitliği tek kaynaktan geliyor.

import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/identity";
import { monthParamISO, monthParamToDate } from "@/lib/date";
import { MONTHLY_TARGET_UNITS, POINT_PROFILE_LABEL } from "@/lib/points/catalog";
import { unitsToPoints } from "@/lib/points/units";
import { listPersonPointSummaries } from "@/lib/repositories/pointLedger";
import { listPointPackagesForMonth } from "@/lib/repositories/pointPackages";
import { listPersonPointProfiles } from "@/lib/repositories/pointCatalog";
import { buildXlsx, xlsxFileName } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireReportAccess();
  const params = new URL(request.url).searchParams;
  const month = monthParamISO(monthParamToDate(params.get("month") ?? undefined));

  const summaries = listPersonPointSummaries(month);
  const packages = listPointPackagesForMonth(month);
  const profiles = new Map(
    listPersonPointProfiles()
      .filter((row) => row.effective_from <= `${month}-01` && (row.effective_to === null || row.effective_to >= `${month}-01`))
      .map((row) => [row.person_id, row.profile]),
  );

  const summarySheet = {
    name: "Kazanılmış puan",
    columns: [
      { header: "Kişi", width: 24 },
      { header: "Profil", width: 22 },
      { header: "Temel iş", width: 12 },
      { header: "Ek iş", width: 10 },
      { header: "Yönetici", width: 12 },
      { header: "Düzeltme", width: 12 },
      { header: "Kazanılmış", width: 12 },
      { header: "Hedef", width: 10 },
      { header: "Hedef üstü", width: 12 },
    ],
    rows: summaries.map((row) => [
      row.person_name,
      profiles.has(row.person_id) ? POINT_PROFILE_LABEL[profiles.get(row.person_id)!] : "Profil atanmadı",
      unitsToPoints(row.base_units),
      unitsToPoints(row.extra_units),
      unitsToPoints(row.manager_units),
      unitsToPoints(row.correction_units),
      unitsToPoints(row.total_units),
      unitsToPoints(MONTHLY_TARGET_UNITS),
      unitsToPoints(Math.max(0, row.total_units - MONTHLY_TARGET_UNITS)),
    ]),
  };

  const packageSheet = {
    name: "Puan paketleri",
    columns: [
      { header: "Hak sahibi", width: 24 },
      { header: "Profil", width: 22 },
      { header: "Kapsam", width: 22 },
      { header: "Kalem", width: 20 },
      { header: "Onaylı", width: 10 },
      { header: "Gereken", width: 10 },
      { header: "Durum", width: 16 },
      { header: "Kazanılan puan", width: 14 },
    ],
    rows: packages.map((row) => [
      row.person_name,
      POINT_PROFILE_LABEL[row.profile],
      row.scope === "brand" ? (row.brand_name ?? "Marka yok") : "Kişi · aylık",
      row.item_key,
      row.approved_count,
      row.required_count,
      row.status === "Tamamlandi" ? "Tamamlandı" : "Açık · paket tamamlanmadı",
      // Eksik pakette puan 0: kısmi puan yok.
      row.status === "Tamamlandi" ? unitsToPoints(row.amount_units) : 0,
    ]),
  };

  const buffer = buildXlsx([summarySheet, packageSheet]);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${xlsxFileName(["kazanilmis-puan", month])}"`,
    },
  });
}
