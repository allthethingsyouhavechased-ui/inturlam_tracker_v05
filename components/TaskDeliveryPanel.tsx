import RequestImagePicker from "@/components/RequestImagePicker";
/* eslint-disable @next/next/no-img-element */
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import {
  TASK_DELIVERY_STATUS_BADGE,
  TASK_DELIVERY_STATUS_LABEL,
  TASK_REVISION_REASON_LABEL,
  TASK_REVISION_REASONS,
} from "@/lib/constants";
import {
  createTaskDeliveryAction,
  decideTeamTaskDeliveryAction,
} from "@/lib/actions/deliveries";
import { formatDateTime } from "@/lib/date";
import { TASK_REVISION_TARGET_OPTIONS } from "@/lib/taskRevisions";
import type { TaskDelivery, TaskStatus } from "@/lib/types";

const inputClass = controlClass();

function DeliveryAssets({ delivery }: { delivery: TaskDelivery }) {
  if (!delivery.external_url && delivery.attachments.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {delivery.external_url && (
        <a
          href={delivery.external_url}
          target="_blank"
          rel="noreferrer"
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          Teslim bağlantısını aç ↗
        </a>
      )}
      {delivery.attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.file_path}
          target="_blank"
          rel="noreferrer"
          className="group block"
        >
          <img
            src={attachment.file_path}
            alt={attachment.original_name ?? `V${delivery.version_number} önizleme`}
            className="h-16 w-20 rounded-lg border border-border-default object-cover transition group-hover:border-brand-500"
          />
        </a>
      ))}
    </div>
  );
}

function DeliverySummary({ delivery }: { delivery: TaskDelivery }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">V{delivery.version_number}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_DELIVERY_STATUS_BADGE[delivery.status]}`}>
          {TASK_DELIVERY_STATUS_LABEL[delivery.status]}
        </span>
        {delivery.guest_visible === 1 && (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300">
            Guest ile paylaşıldı
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        {delivery.submitted_by_name} · {formatDateTime(delivery.submitted_at)}
      </p>
      {delivery.note && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{delivery.note}</p>}
      <DeliveryAssets delivery={delivery} />
      {delivery.status !== "Beklemede" && (
        <div className="mt-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-secondary">
          <p className="font-semibold text-foreground">
            {delivery.decided_by_name} · {delivery.decided_at ? formatDateTime(delivery.decided_at) : "Karar verildi"}
          </p>
          {delivery.revision_reason && (
            <p className="mt-1">Neden: {TASK_REVISION_REASON_LABEL[delivery.revision_reason]}</p>
          )}
          {delivery.decision_note && <p className="mt-1 whitespace-pre-wrap leading-5">{delivery.decision_note}</p>}
        </div>
      )}
    </div>
  );
}

function PendingDecision({ delivery }: { delivery: TaskDelivery }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <ActionForm
        action={decideTeamTaskDeliveryAction}
        successMessage={`V${delivery.version_number} onaylandı.`}
        className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20"
      >
        <input type="hidden" name="deliveryId" value={delivery.id} />
        <input type="hidden" name="decision" value="Onaylandi" />
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Teslim uygunsa onayla</p>
        <textarea
          name="decisionNote"
          maxLength={2000}
          rows={2}
          placeholder="Onay notu (opsiyonel)"
          className={controlClass("mt-2 bg-surface")}
        />
        <SubmitButton
          pendingLabel="Onaylanıyor…"
          className={buttonClass({ className: "mt-2 w-full bg-emerald-600 hover:bg-emerald-700" })}
        >
          Teslimi onayla
        </SubmitButton>
      </ActionForm>

      <ActionForm
        action={decideTeamTaskDeliveryAction}
        successMessage={`V${delivery.version_number} için revize açıldı.`}
        className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20"
      >
        <input type="hidden" name="deliveryId" value={delivery.id} />
        <input type="hidden" name="decision" value="RevizeIstendi" />
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Değişiklik gerekiyorsa revize iste</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-[11px] font-medium text-secondary">
            Revize nedeni
            <select name="revisionReason" required defaultValue="" className={inputClass}>
              <option value="" disabled>Neden seç</option>
              {TASK_REVISION_REASONS.map((reason) => (
                <option key={reason} value={reason}>{TASK_REVISION_REASON_LABEL[reason]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-secondary">
            Hedef süre
            <select name="revisionTargetMinutes" required defaultValue="480" className={inputClass}>
              {TASK_REVISION_TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          name="decisionNote"
          required
          maxLength={2000}
          rows={2}
          placeholder="İstenen değişiklikleri açıkça yaz…"
          className={controlClass("mt-2 bg-surface")}
        />
        <SubmitButton
          pendingLabel="Revize açılıyor…"
          className={buttonClass({ variant: "secondary", className: "mt-2 w-full border-amber-300" })}
        >
          Revize iste
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export default function TaskDeliveryPanel({
  taskId,
  taskStatus,
  taskOrigin,
  planned,
  archived,
  deliveries,
  canDecide = false,
}: {
  taskId: string;
  taskStatus: TaskStatus;
  taskOrigin: "team" | "guest";
  planned: boolean;
  archived: boolean;
  deliveries: TaskDelivery[];
  canDecide?: boolean;
}) {
  const pending = deliveries.find((delivery) => delivery.status === "Beklemede") ?? null;
  const history = deliveries.filter((delivery) => delivery.id !== pending?.id);
  const canSubmit = planned && !archived && taskStatus !== "Yayinlandi" && !pending;

  return (
    <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">TESLİM VE ONAY</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">Versiyonlu çalışma teslimi</h2>
          <p className="mt-1 text-xs text-muted">Her teslim bir versiyon olarak saklanır; onay veya revize kararı kayıt altına alınır.</p>
        </div>
        <p className="text-xs text-muted"><strong className="text-base font-semibold tabular-nums text-foreground">{deliveries.length}</strong> versiyon</p>
      </div>

      {pending && (
        <div className="border-b border-border-subtle bg-brand-50/40 px-4 py-4 dark:bg-brand-950/10 sm:px-5">
          <p className="mb-3 text-xs font-semibold text-brand-700 dark:text-brand-300">Karar bekleyen teslim</p>
          <DeliverySummary delivery={pending} />
          {canDecide ? <PendingDecision delivery={pending} /> : <p className="mt-3 text-xs text-muted">Teslim için yönetici kararı bekleniyor.</p>}
        </div>
      )}

      {canSubmit && (
        <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
          <ActionForm
            action={createTaskDeliveryAction}
            successMessage="Yeni teslim incelemeye gönderildi."
            resetOnSuccess
            className="grid gap-3"
          >
            <input type="hidden" name="taskId" value={taskId} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Teslim bağlantısı <span className="font-normal text-muted">(opsiyonel)</span>
                <input name="externalUrl" type="url" maxLength={2000} placeholder="https://…" className={inputClass} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Önizleme görselleri <span className="font-normal text-muted">(opsiyonel)</span>
                <RequestImagePicker />
              </label>
            </div>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Teslim notu <span className="font-normal text-muted">(bağlantı veya görsel yoksa zorunlu)</span>
              <textarea name="note" maxLength={2000} rows={3} placeholder="Bu versiyonda yapılanları ve incelenmesi gereken noktaları yaz…" className={inputClass} />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {taskOrigin === "guest" ? (
                <label className="inline-flex items-center gap-2 text-xs font-medium text-secondary">
                  <input type="checkbox" name="guestVisible" value="1" className="h-4 w-4 rounded border-border-default accent-brand-600" />
                  Bu teslimi guest ile paylaş
                </label>
              ) : <span />}
              <SubmitButton pendingLabel="Teslim ediliyor…">Yeni versiyonu teslim et</SubmitButton>
            </div>
          </ActionForm>
        </div>
      )}

      {!canSubmit && !pending && (
        <p className="border-b border-border-subtle px-4 py-3 text-xs text-muted sm:px-5">
          {!planned
            ? "Teslim göndermeden önce iç teslim tarihini planlayın."
            : "Yayınlanmış veya arşivlenmiş göreve yeni teslim eklenemez."}
        </p>
      )}

      <div className="px-4 py-3 sm:px-5">
        {history.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">Henüz sonuçlanmış bir teslim yok.</p>
        ) : (
          <details open={history.length <= 3}>
            <summary className="cursor-pointer py-1 text-xs font-semibold text-secondary">Teslim geçmişi · {history.length}</summary>
            <ol className="mt-2 divide-y divide-border-subtle">
              {history.map((delivery) => (
                <li key={delivery.id} className="py-4"><DeliverySummary delivery={delivery} /></li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </section>
  );
}
