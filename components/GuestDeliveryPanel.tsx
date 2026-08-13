/* eslint-disable @next/next/no-img-element */
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import { decideGuestTaskDeliveryAction } from "@/lib/actions/deliveries";
import {
  TASK_DELIVERY_STATUS_BADGE,
  TASK_DELIVERY_STATUS_LABEL,
  TASK_REVISION_REASON_LABEL,
  TASK_REVISION_REASONS,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/date";
import type { GuestTaskDelivery } from "@/lib/types";

const TARGET_OPTIONS = [
  { value: 60, label: "1 saat" },
  { value: 240, label: "4 saat" },
  { value: 480, label: "8 saat" },
  { value: 1440, label: "1 gün" },
  { value: 2880, label: "2 gün" },
] as const;

function GuestDeliverySummary({ delivery }: { delivery: GuestTaskDelivery }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">V{delivery.version_number}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_DELIVERY_STATUS_BADGE[delivery.status]}`}>
          {TASK_DELIVERY_STATUS_LABEL[delivery.status]}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{delivery.submitted_by_name} · {formatDateTime(delivery.submitted_at)}</p>
      {delivery.note && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{delivery.note}</p>}
      {(delivery.external_url || delivery.attachments.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {delivery.external_url && (
            <a href={delivery.external_url} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
              Teslim bağlantısını aç ↗
            </a>
          )}
          {delivery.attachments.map((attachment) => (
            <a key={attachment.id} href={attachment.file_path} target="_blank" rel="noreferrer">
              <img
                src={attachment.file_path}
                alt={attachment.original_name ?? `V${delivery.version_number} önizleme`}
                className="h-16 w-20 rounded-lg border border-border-default object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {delivery.status !== "Beklemede" && (
        <div className="mt-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-secondary">
          <p className="font-semibold text-foreground">
            {delivery.decided_by_name} · {delivery.decided_at ? formatDateTime(delivery.decided_at) : "Karar verildi"}
          </p>
          {delivery.revision_reason && <p className="mt-1">Neden: {TASK_REVISION_REASON_LABEL[delivery.revision_reason]}</p>}
          {delivery.decision_note && <p className="mt-1 whitespace-pre-wrap leading-5">{delivery.decision_note}</p>}
        </div>
      )}
    </div>
  );
}

function GuestDecisionForms({ delivery }: { delivery: GuestTaskDelivery }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <ActionForm
        action={decideGuestTaskDeliveryAction}
        successMessage={`V${delivery.version_number} onaylandı.`}
        className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20"
      >
        <input type="hidden" name="deliveryId" value={delivery.id} />
        <input type="hidden" name="decision" value="Onaylandi" />
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Çalışma uygunsa onaylayın</p>
        <textarea name="decisionNote" maxLength={2000} rows={2} placeholder="Onay notu (opsiyonel)" className={controlClass("mt-2 bg-surface")} />
        <SubmitButton pendingLabel="Onaylanıyor…" className={buttonClass({ className: "mt-2 w-full bg-emerald-600 hover:bg-emerald-700" })}>
          Teslimi onayla
        </SubmitButton>
      </ActionForm>

      <ActionForm
        action={decideGuestTaskDeliveryAction}
        successMessage={`V${delivery.version_number} için revize talebi iletildi.`}
        className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20"
      >
        <input type="hidden" name="deliveryId" value={delivery.id} />
        <input type="hidden" name="decision" value="RevizeIstendi" />
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Değişiklik gerekiyorsa revize isteyin</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-[11px] font-medium text-secondary">
            Revize nedeni
            <select name="revisionReason" required defaultValue="" className={controlClass()}>
              <option value="" disabled>Neden seçin</option>
              {TASK_REVISION_REASONS.map((reason) => (
                <option key={reason} value={reason}>{TASK_REVISION_REASON_LABEL[reason]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-secondary">
            Beklenen süre
            <select name="revisionTargetMinutes" required defaultValue="480" className={controlClass()}>
              {TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <textarea name="decisionNote" required maxLength={2000} rows={2} placeholder="İstediğiniz değişiklikleri açıkça yazın…" className={controlClass("mt-2 bg-surface")} />
        <SubmitButton pendingLabel="Gönderiliyor…" className={buttonClass({ variant: "secondary", className: "mt-2 w-full border-amber-300" })}>
          Revize iste
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export default function GuestDeliveryPanel({ deliveries }: { deliveries: GuestTaskDelivery[] }) {
  if (deliveries.length === 0) return null;
  const pending = deliveries.find((delivery) => delivery.status === "Beklemede") ?? null;
  const history = deliveries.filter((delivery) => delivery.id !== pending?.id);

  return (
    <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="border-b border-border-subtle px-4 py-3 sm:px-5">
        <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">TESLİMLER</p>
        <h2 className="mt-1 text-sm font-semibold text-foreground">İncelemenize sunulan çalışmalar</h2>
      </div>
      {pending && (
        <div className="border-b border-border-subtle bg-brand-50/40 p-4 dark:bg-brand-950/10 sm:p-5">
          <p className="mb-3 text-xs font-semibold text-brand-700 dark:text-brand-300">Kararınızı bekliyor</p>
          <GuestDeliverySummary delivery={pending} />
          <GuestDecisionForms delivery={pending} />
        </div>
      )}
      {history.length > 0 && (
        <div className="px-4 py-3 sm:px-5">
          <details open={history.length <= 2}>
            <summary className="cursor-pointer py-1 text-xs font-semibold text-secondary">Önceki teslimler · {history.length}</summary>
            <ol className="mt-2 divide-y divide-border-subtle">
              {history.map((delivery) => <li key={delivery.id} className="py-4"><GuestDeliverySummary delivery={delivery} /></li>)}
            </ol>
          </details>
        </div>
      )}
    </section>
  );
}
