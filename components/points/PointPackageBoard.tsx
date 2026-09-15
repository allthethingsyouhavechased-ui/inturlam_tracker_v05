import { POINT_PROFILE_LABEL } from "@/lib/points/catalog";
import { formatUnitsAsPoints } from "@/lib/points/units";
import type { PointPackageProgress } from "@/lib/repositories/pointPackages";

/**
 * Paket durumları. 3/4 tamamlanma bir İLERLEME göstergesidir, puan değildir —
 * eksik pakette açıkça "0 puan · paket tamamlanmadı" yazıyor.
 */
export default function PointPackageBoard({
  month,
  packages,
}: {
  month: string;
  packages: PointPackageProgress[];
}) {
  return (
    <section className="rounded-xl border border-border-default bg-surface">
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Puan paketleri · {month}</h2>
        <p className="mt-1 text-xs text-muted">
          Paket sınırı: departman + marka + plan ayı + iş kalemi. AI kaleminde marka çarpanı yoktur,
          kota kişi bazındadır. Paket tamamlanmadan puan doğmaz.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-[11px] tracking-[0.08em] text-muted">
              <th className="px-3 py-2 font-medium">Hak sahibi</th>
              <th className="px-3 py-2 font-medium">Profil</th>
              <th className="px-3 py-2 font-medium">Kapsam</th>
              <th className="px-3 py-2 font-medium">Kalem</th>
              <th className="px-3 py-2 font-medium">Onaylı / gereken</th>
              <th className="px-3 py-2 font-medium">Durum</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((row) => {
              const complete = row.status === "Tamamlandi";
              return (
                <tr key={row.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-3 py-2 font-medium">{row.person_name}</td>
                  <td className="px-3 py-2 text-xs text-muted">{POINT_PROFILE_LABEL[row.profile]}</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {row.scope === "brand" ? (row.brand_name ?? "Marka yok") : "Kişi · aylık"}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.item_key}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.approved_count} / {row.required_count}
                    {row.member_count !== row.required_count && (
                      <span className="ml-1 text-xs text-warning">({row.member_count} üye)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {complete ? (
                      <span className="font-semibold text-success">
                        {formatUnitsAsPoints(row.amount_units)} puan
                      </span>
                    ) : (
                      <span className="text-xs text-muted">0 puan · paket tamamlanmadı</span>
                    )}
                    {row.scope_change_note && (
                      <span className="ml-2 text-[10px] text-muted">kapsam değişti</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {packages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">
                  Bu ayda açılmış puan paketi yok. Paketler yalnızca yönetici önizlemesiyle açılır;
                  patch kurulunca kimseye otomatik kota görevi üretilmez.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
