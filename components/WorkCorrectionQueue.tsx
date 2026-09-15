import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { controlClass } from "@/components/ui/Input";
import { decideWorkCorrectionAction } from "@/lib/actions/worklog";
import type { WorkCorrectionRow } from "@/lib/repositories/worklog";

const inputClass = controlClass();

function istanbulTime(stamp: string | null): string {
  if (!stamp) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(stamp.includes("T") ? stamp : `${stamp.replace(" ", "T")}Z`));
}

/**
 * Bekleyen mesai düzeltmeleri. Onaylanınca ESKİ değerler kayıtta korunarak
 * yeni saatler yazılır; saat otomatik uydurulmaz.
 */
export default function WorkCorrectionQueue({ corrections }: { corrections: WorkCorrectionRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Bekleyen mesai düzeltmeleri</h2>
        <p className="mt-1 text-xs text-muted">
          Eski ve yeni değerler birlikte saklanır; onay kaydı silmez.
        </p>
      </div>
      <div className="divide-y divide-border-subtle">
        {corrections.map((correction) => (
          <div key={correction.id} className="space-y-2 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {correction.requested_by_name ?? "Bilinmeyen kişi"}
            </p>
            <p className="text-xs text-secondary">
              Eski: {istanbulTime(correction.previous_started_at)} → {istanbulTime(correction.previous_ended_at)}
              {" · "}Önerilen: {istanbulTime(correction.proposed_started_at)} → {istanbulTime(correction.proposed_ended_at)}
            </p>
            <p className="text-xs text-muted">Gerekçe: {correction.reason}</p>
            <ActionForm action={decideWorkCorrectionAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="correctionId" value={correction.id} />
              <label className="grid gap-1 text-xs font-medium text-secondary">
                Karar notu <span className="font-normal text-muted">(opsiyonel)</span>
                <input name="note" maxLength={500} className={inputClass} />
              </label>
              <SubmitButton
                pendingLabel="…"
                className="min-h-9 rounded-[9px] bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500"
              >
                Onayla
              </SubmitButton>
              <input type="hidden" name="decision" value="approve" />
            </ActionForm>
            <ActionForm action={decideWorkCorrectionAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="correctionId" value={correction.id} />
              <input type="hidden" name="decision" value="reject" />
              <SubmitButton
                pendingLabel="…"
                className="min-h-9 rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold text-danger hover:bg-surface-hover"
              >
                Reddet
              </SubmitButton>
            </ActionForm>
          </div>
        ))}
        {corrections.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">Bekleyen düzeltme isteği yok.</p>
        )}
      </div>
    </section>
  );
}
