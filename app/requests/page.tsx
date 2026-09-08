import Link from "next/link";
import { notFound } from "next/navigation";
import ClientRequestCreateDialog from "@/components/ClientRequestCreateDialog";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import {
  CLIENT_REQUEST_STATUSES,
  CLIENT_REQUEST_STATUS_DOT,
  CLIENT_REQUEST_STATUS_LABEL,
  CLIENT_REQUEST_STATUS_TONE,
} from "@/lib/clientRequests";
import { CONTENT_TYPE_LABEL } from "@/lib/constants";
import { departmentLabel } from "@/lib/departments";
import { formatDateLong, formatDateTime } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { canReviewClientRequests } from "@/lib/requestAccess";
import { listBrandsAlphabetically } from "@/lib/repositories/brands";
import {
  countArchivedClientRequests,
  listClientRequestsForPerson,
  sweepArchivableClientRequests,
} from "@/lib/repositories/clientRequests";
import type { ClientRequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function isRequestStatus(value: unknown): value is ClientRequestStatus {
  return CLIENT_REQUEST_STATUSES.includes(value as ClientRequestStatus);
}

export default async function ClientRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const person = await requirePageSession();
  if (!canReviewClientRequests(person)) notFound();
  sweepArchivableClientRequests();
  const sp = await searchParams;
  const showArchive = sp.view === "archive";
  const allRequests = listClientRequestsForPerson(person.id, true, showArchive);
  const archivedCount = countArchivedClientRequests();
  const brands = listBrandsAlphabetically();
  const selectedStatus = isRequestStatus(sp.status)
    ? (sp.status as ClientRequestStatus)
    : null;
  const requests = selectedStatus
    ? allRequests.filter((request) => request.status === selectedStatus)
    : allRequests;
  const counts = new Map(
    CLIENT_REQUEST_STATUSES.map((status) => [
      status,
      allRequests.filter((request) => request.status === status).length,
    ]),
  );

  return (
    <div>
      <PageHeader
        eyebrow="MÜŞTERİ TALEPLERİ"
        title="Ön talep onayı"
        description="Müşteriden gelen işi değerlendir, doğru ekibe ata ve hazır olduğunda tek adımda göreve dönüştür."
        actions={
          <>
            <Link href={showArchive ? "/requests" : "/requests?view=archive"} className={buttonClass({ variant: "secondary" })}>
              <Icon name="archive" className="size-4" />
              {showArchive ? "Aktif talepler" : `Arşiv · ${archivedCount}`}
            </Link>
            <ClientRequestCreateDialog brands={brands} />
          </>
        }
      />

      {!showArchive && <section className="mb-6 grid grid-cols-2 border-y border-border-subtle sm:grid-cols-4" aria-label="Talep özeti">
        {CLIENT_REQUEST_STATUSES.map((status, index) => (
          <Link
            key={status}
            href={selectedStatus === status ? "/requests" : `/requests?status=${status}`}
            className={`group px-3 py-3.5 transition-colors hover:bg-surface-hover sm:px-4 ${index > 0 ? "border-l border-border-subtle" : ""} ${selectedStatus === status ? "bg-surface-subtle" : ""}`}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold text-muted">
              <span className={`size-1.5 rounded-full ${CLIENT_REQUEST_STATUS_DOT[status]}`} />
              {CLIENT_REQUEST_STATUS_LABEL[status].toLocaleUpperCase("tr-TR")}
            </span>
            <span className="mt-1 block text-xl font-semibold tabular-nums text-foreground">{counts.get(status)}</span>
          </Link>
        ))}
      </section>}

      {showArchive && (
        <div className="mb-6 flex items-center gap-3 border-y border-border-subtle px-1 py-3 text-xs text-muted">
          <Icon name="archive" className="size-4" />
          Onaylanan veya reddedilen talepler karar tarihinden 7 gün sonra burada saklanır.
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{showArchive ? "Talep arşivi" : "Değerlendirme kuyruğu"}</h2>
            <p className="mt-0.5 text-xs text-muted">{requests.length} kayıt gösteriliyor</p>
          </div>
          {selectedStatus && !showArchive && (
            <Link href="/requests" className="text-xs font-semibold text-brand-600 hover:underline">Tüm durumları göster</Link>
          )}
        </div>

        {requests.length === 0 ? (
          <EmptyState
            compact
            title="Bu görünümde talep yok"
            description={showArchive
              ? "Henüz yedi günlük bekleme süresini tamamlayan bir talep yok."
              : selectedStatus
                ? "Başka bir durum seçebilir veya yeni talep ekleyebilirsin."
                : "İlk müşteri talebini üstteki “Yeni talep” düğmesinden kaydet."}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface">
            {requests.map((request, index) => (
              <div
                key={request.id}
                className={`group relative grid min-h-[82px] gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover sm:grid-cols-[minmax(0,1fr)_11rem_9rem_1.5rem] sm:items-center sm:px-5 ${index > 0 ? "border-t border-border-subtle" : ""}`}
              >
                <Link
                  href={`/requests/${request.id}`}
                  aria-label={`${request.title} talebini aç`}
                  className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
                />
                <div className="pointer-events-none relative z-10 min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${CLIENT_REQUEST_STATUS_DOT[request.status]}`} />
                    <h3 className="truncate text-[13px] font-semibold text-foreground group-hover:underline">{request.title}</h3>
                  </div>
                  <p className="mt-1 truncate pl-4 text-xs text-muted">
                    <span className="font-medium text-secondary">{request.brand_name}</span>
                    <span aria-hidden="true"> · </span>{CONTENT_TYPE_LABEL[request.content_type]}
                    <span aria-hidden="true"> · </span>{request.created_by_name}
                  </p>
                  {request.converted_task_id && <Link href={`/tasks/${request.converted_task_id}`} className="pointer-events-auto relative z-20 mt-2 inline-flex min-h-9 items-center pl-4 text-xs font-semibold text-success hover:underline">Göreve dönüştürüldü · Görevi aç →</Link>}
                </div>
                <div className="pointer-events-none relative z-10 pl-4 text-xs sm:pl-0">
                  <span className="block text-[10px] font-semibold tracking-wide text-faint">DEPARTMAN</span>
                  <span className="mt-1 block font-medium text-secondary">{departmentLabel(request.department)}</span>
                </div>
                <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2 pl-4 sm:block sm:pl-0">
                  <Badge tone={CLIENT_REQUEST_STATUS_TONE[request.status]}>{CLIENT_REQUEST_STATUS_LABEL[request.status]}</Badge>
                  <span className="text-[11px] text-muted sm:mt-1.5 sm:block">{request.due_date ? formatDateLong(request.due_date) : formatDateTime(request.created_at)}</span>
                </div>
                <Icon name="chevron-right" className="pointer-events-none relative z-10 hidden size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-secondary sm:block" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
