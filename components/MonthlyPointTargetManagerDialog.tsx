"use client";

import { useState } from "react";
import MonthlyPointTargetEditor from "@/components/MonthlyPointTargetEditor";
import PageActionDialog from "@/components/ui/PageActionDialog";
import { formatIsoDateTime } from "@/lib/date";
import type { PersonPointTargetRow, PointTargetChange } from "@/lib/repositories/monthlyPointTargets";

export default function MonthlyPointTargetManagerDialog({
  month,
  rows,
  changes,
  isPast,
  initialOpen = false,
}: {
  month: string;
  rows: PersonPointTargetRow[];
  changes: PointTargetChange[];
  isPast: boolean;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <PageActionDialog
      open={open}
      onOpenChange={setOpen}
      triggerLabel="Hedefleri düzenle"
      title={`Aylık hedefleri düzenle · ${month}`}
      description="Her kişinin sabit aylık hedefini belirleyin. Kazanılan puan ve gerçekleşme oranı hedefin üzerine çıkabilir."
    >
      <div className="space-y-5">
        <MonthlyPointTargetEditor key={month} month={month} rows={rows} isPast={isPast} />
        <p className="text-xs leading-5 text-muted">
          Kazanım, iç teslim tarihi bu aya düşen görevlerin durum katsayılarıyla hesaplanır. Henüz tamamlanmamış işlerin aşama katkısı da dahildir. Hedefler sonraki aya otomatik taşınmaz.
        </p>
        <details className="rounded-xl border border-border-default bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold">Hedef değişiklik geçmişi · {month}</summary>
          <p className="mt-2 text-xs text-muted">Bu ayın son 100 değişikliği.</p>
          <ul className="mt-3 space-y-3">
            {changes.map((change) => (
              <li key={change.id} className="border-t border-border-subtle pt-3 text-sm">
                <p className="font-medium">
                  {change.person_name}: {change.previous_points ?? "Hedef yok"} → {change.target_points} puan
                </p>
                <p className="mt-1 text-xs text-muted">{change.actor_name} · {formatIsoDateTime(change.created_at)}</p>
                {change.note && <p className="mt-1 text-xs text-secondary">{change.note}</p>}
              </li>
            ))}
            {!changes.length && <li className="text-xs text-muted">Henüz hedef değişikliği yok.</li>}
          </ul>
        </details>
      </div>
    </PageActionDialog>
  );
}
