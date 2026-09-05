"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMonthlyPointTargetsAction } from "@/lib/actions/monthlyPointTargets";
import { buttonClass } from "@/components/ui/Button";
import { formatPoints } from "@/lib/progress";
import type { PersonPointTargetRow, PointTargetUpdate } from "@/lib/repositories/monthlyPointTargets";

export default function MonthlyPointTargetEditor({ month, rows, isPast }: { month: string; rows: PersonPointTargetRow[]; isPast: boolean }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("50");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputClass = "min-h-11 w-28 rounded-md border border-border-default bg-background px-3 text-sm tabular-nums text-foreground focus-visible:outline-2 focus-visible:outline-brand-600";

  return (
    <form onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      const updates: PointTargetUpdate[] = [];
      for (const row of rows) {
        if (!(row.person_id in draft) || draft[row.person_id] === String(row.target_points ?? "")) continue;
        updates.push({ personId: row.person_id, targetPoints: Number(draft[row.person_id]), expectedPoints: row.target_points });
      }
      if (!updates.length) { setResult({ ok: true, message: "Kaydedilecek değişiklik yok." }); return; }
      setResult(null);
      startTransition(async () => {
        try {
          const response = await saveMonthlyPointTargetsAction(month, updates, note);
          setResult(response);
          if (response.ok) { setDraft({}); setNote(""); router.refresh(); }
        } catch { setResult({ ok: false, message: "Bağlantı kurulamadı. Girdileriniz korundu; tekrar deneyin." }); }
      });
    }} className="space-y-4">
      {isPast && <p className="rounded-lg border border-border-default bg-surface-subtle p-3 text-sm text-secondary">Geçmiş bir ayı düzenliyorsunuz. Değişiklik yalnız {month} hedeflerine uygulanır ve geçmişe kaydedilir.</p>}
      <fieldset disabled={pending} className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-default bg-surface p-4">
          <label className="grid gap-1 text-xs font-semibold text-secondary">Ortak hedef puanı
            <input aria-label="Ortak hedef puanı" type="number" min={1} max={100000} step={1} value={bulk} onChange={e => setBulk(e.target.value)} className={inputClass} />
          </label>
          <button type="button" className={buttonClass({ variant: "secondary" })} onClick={() => {
            setDraft(current => ({ ...current, ...Object.fromEntries(rows.filter(r => r.active === 1).map(r => [r.person_id, bulk])) }));
            setResult(null);
          }}>Aktif ekibe uygula</button>
          <p className="text-xs text-muted">Önce değerleri kontrol edin, ardından kaydedin.</p>
        </div>
        <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface">
          {rows.map(row => (
            <div key={row.person_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <label htmlFor={`target-${row.person_id}`} className="block text-sm font-semibold text-foreground">{row.person_name}{row.active ? "" : " · Pasif"}</label>
                <p className="mt-1 text-xs text-muted">Kazanılan: {formatPoints(row.earned_points)} · Atanan: {formatPoints(row.assigned_points)} puan</p>
              </div>
              <div className="flex items-center gap-2">
                <input id={`target-${row.person_id}`} aria-label={`${row.person_name} aylık hedef puanı`} type="number" min={1} max={100000} step={1}
                  placeholder="Hedef yok" value={draft[row.person_id] ?? String(row.target_points ?? "")}
                  onChange={e => { setDraft(current => ({ ...current, [row.person_id]: e.target.value })); setResult(null); }} className={inputClass} />
                <span className="text-xs text-muted">puan</span>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="p-4 text-sm text-muted">Hedef atanabilecek ekip üyesi yok.</p>}
        </div>
        <label className="grid gap-1 text-xs font-semibold text-secondary">Değişiklik açıklaması (isteğe bağlı)
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} className="min-h-11 rounded-md border border-border-default bg-surface px-3 text-sm text-foreground" />
        </label>
        <button disabled={pending || !rows.length} className={buttonClass()} type="submit">{pending ? "Kaydediliyor…" : "Hedefleri kaydet"}</button>
      </fieldset>
      {result && <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.message}</p>}
    </form>
  );
}
