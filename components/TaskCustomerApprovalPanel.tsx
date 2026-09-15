"use client";

import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { controlClass } from "@/components/ui/Input";
import {
  recordCustomerApprovalAction,
  setTaskCustomerApprovalAction,
} from "@/lib/actions/customerApprovals";
import {
  CUSTOMER_APPROVAL_CHANNELS,
  CUSTOMER_APPROVAL_CHANNEL_LABEL,
} from "@/lib/taskApproval";
import { formatDateTime } from "@/lib/date";
import type { TaskCustomerApproval, TaskStatus } from "@/lib/types";

const inputClass = controlClass();

/**
 * Müşteri onayı kartı. Onayı müşteri portalı değil, YETKİLİ EKİP ÜYESİ
 * dışarıdan gelen bilgiye dayanarak kaydediyor: hangi teslim sürümü, onayı
 * veren müşteri, kanal ve zaman. Bağlantı isteğe bağlı.
 */
export default function TaskCustomerApprovalPanel({
  taskId,
  taskStatus,
  required,
  exceptionNote,
  approvals,
  canRecord,
  latestDeliveryVersion,
  latestDeliveryApproved,
}: {
  taskId: string;
  taskStatus: TaskStatus;
  required: boolean;
  exceptionNote: string | null;
  approvals: TaskCustomerApproval[];
  canRecord: boolean;
  latestDeliveryVersion: number | null;
  latestDeliveryApproved: boolean;
}) {
  const active = approvals.find((approval) => approval.invalidated_at === null);
  const canRecordNow = canRecord && required && latestDeliveryApproved && !active
    && taskStatus !== "Yayinlandi";

  return (
    <section className="space-y-4 rounded-xl border border-border-default bg-surface p-4 sm:p-5">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-base font-semibold text-foreground">Müşteri onayı</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          {required
            ? "Bu iş müşteri onayı olmadan yayınlanamaz. Onayı yetkili ekip üyesi, müşteriden gelen bilgiye dayanarak kaydeder."
            : "Bu işte müşteri onayı gerekmiyor; ekip onayından sonra doğrudan yayınlanabilir."}
        </p>
        {exceptionNote && (
          <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-secondary">
            <span className="font-semibold">Görev özelinde istisna:</span> {exceptionNote}
          </p>
        )}
      </div>

      {active ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-3 text-xs dark:border-emerald-800 dark:bg-emerald-950/20">
          <p className="font-semibold text-foreground">
            {active.customer_name} onayladı
            {active.delivery_version ? ` · V${active.delivery_version}` : ""}
          </p>
          <p className="mt-1 text-secondary">
            {CUSTOMER_APPROVAL_CHANNEL_LABEL[active.channel]} · {formatDateTime(active.approved_at)} ·
            {" "}kaydeden {active.recorded_by_name}
          </p>
          {active.note && <p className="mt-1 whitespace-pre-wrap text-secondary">{active.note}</p>}
          {active.reference_url && (
            <a href={active.reference_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-brand-600 hover:underline dark:text-brand-300">
              Kanıt bağlantısı ↗
            </a>
          )}
        </div>
      ) : required && !latestDeliveryApproved ? (
        <p className="rounded-lg border border-dashed border-border-default px-3 py-3 text-xs text-muted">
          Müşteri onayı kaydedilmeden önce teslim ekipçe onaylanmalı.
          {latestDeliveryVersion ? ` Son sürüm: V${latestDeliveryVersion}.` : " Henüz teslim yok."}
        </p>
      ) : null}

      {canRecordNow && (
        <ActionForm
          action={recordCustomerApprovalAction}
          className="grid gap-3 rounded-lg border border-border-subtle bg-surface-subtle p-3 sm:grid-cols-2"
        >
          <input type="hidden" name="taskId" value={taskId} />
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Onayı veren müşteri
            <input name="customerName" required maxLength={120} className={inputClass} placeholder="Ör. Ayşe Hanım" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Kanal
            <select name="channel" required defaultValue="Toplanti" className={inputClass}>
              {CUSTOMER_APPROVAL_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>{CUSTOMER_APPROVAL_CHANNEL_LABEL[channel]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary sm:col-span-2">
            Kanıt bağlantısı <span className="font-normal text-muted">(opsiyonel)</span>
            <input name="referenceUrl" type="url" maxLength={500} className={inputClass} placeholder="https://…" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary sm:col-span-2">
            Not <span className="font-normal text-muted">(opsiyonel)</span>
            <textarea name="note" rows={2} maxLength={1000} className={inputClass} />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Kaydediliyor…">Müşteri onayını kaydet</SubmitButton>
          </div>
        </ActionForm>
      )}

      {canRecord && taskStatus !== "Yayinlandi" && (
        <ActionForm
          action={setTaskCustomerApprovalAction}
          className="grid gap-2 border-t border-border-subtle pt-4 text-xs"
        >
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="required" value={required ? "0" : "1"} />
          <label className="grid gap-1.5 font-medium text-secondary">
            {required ? "Bu görevde müşteri onayını kaldır" : "Bu görevde müşteri onayını zorunlu yap"}
            <input name="reason" required maxLength={500} className={inputClass} placeholder="Gerekçe zorunlu" />
          </label>
          <div>
            <SubmitButton
              pendingLabel="Uygulanıyor…"
              className="min-h-9 rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover"
            >
              İstisnayı uygula
            </SubmitButton>
          </div>
        </ActionForm>
      )}

      {approvals.length > 1 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-secondary">Onay geçmişi ({approvals.length})</summary>
          <ul className="mt-2 space-y-1 text-muted">
            {approvals.map((approval) => (
              <li key={approval.id}>
                {approval.delivery_version ? `V${approval.delivery_version} · ` : ""}
                {approval.customer_name} · {CUSTOMER_APPROVAL_CHANNEL_LABEL[approval.channel]} ·
                {" "}{formatDateTime(approval.approved_at)}
                {approval.invalidated_at && " · yeni sürümle geçersizleşti"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
