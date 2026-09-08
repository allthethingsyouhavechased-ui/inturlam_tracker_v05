import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityFeed from "@/components/ActivityFeed";
import DeleteClientRequestButton from "@/components/DeleteClientRequestButton";
import EditClientRequestForm from "@/components/EditClientRequestForm";
import PersonAvatar from "@/components/PersonAvatar";
import RequestReviewForm from "@/components/RequestReviewForm";
import SubmitButton from "@/components/SubmitButton";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { addClientRequestCommentAction } from "@/lib/actions/clientRequests";
import {
  CLIENT_REQUEST_STATUS_LABEL,
  CLIENT_REQUEST_STATUS_TONE,
} from "@/lib/clientRequests";
import { CONTENT_TYPE_LABEL, TASK_PRIORITY_LABEL } from "@/lib/constants";
import { departmentLabel } from "@/lib/departments";
import { formatDateLong, formatDateTime } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { canReviewClientRequests } from "@/lib/requestAccess";
import { listActivityForEntity } from "@/lib/repositories/activity";
import {
  getClientRequest,
  listClientRequestAttachments,
  listClientRequestComments,
} from "@/lib/repositories/clientRequests";
import { listBrandsAlphabetically } from "@/lib/repositories/brands";
import { listActivePeople } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function ClientRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const person = await requirePageSession();
  if (!canReviewClientRequests(person)) notFound();
  const { requestId } = await params;
  const request = getClientRequest(requestId);
  if (!request) notFound();

  const comments = listClientRequestComments(requestId);
  const attachments = listClientRequestAttachments(requestId);
  const activity = listActivityForEntity("request", requestId);
  const people = listActivePeople();
  const brands = listBrandsAlphabetically();
  const isOpen = (request.status === "Beklemede" || request.status === "Incelemede") && !request.archived_at;
  const canEdit = !request.converted_task_id && !request.archived_at;

  return (
    <div>
      <PageHeader
        eyebrow="TALEP DEĞERLENDİRME"
        title={request.title}
        description={`${request.brand_name} · ${CONTENT_TYPE_LABEL[request.content_type]}`}
        breadcrumb={[
          { label: "Talepler", href: "/requests" },
          { label: request.brand_name },
          { label: request.title },
        ]}
        actions={
          <>
            {request.converted_task_id && (
              <Link href={`/tasks/${request.converted_task_id}`} className={buttonClass()}>
                Oluşan görevi aç <Icon name="arrow-right" className="size-4" />
              </Link>
            )}
            {canEdit && <EditClientRequestForm request={request} brands={brands} />}
            <DeleteClientRequestButton requestId={request.id} converted={Boolean(request.converted_task_id)} />
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border-subtle pb-4 text-xs text-muted">
        <Badge tone={CLIENT_REQUEST_STATUS_TONE[request.status]}>
          {CLIENT_REQUEST_STATUS_LABEL[request.status]}
        </Badge>
        <span><span className="text-faint">Kaydeden</span> · {request.created_by_name}</span>
        <span><span className="text-faint">Geliş</span> · {formatDateTime(request.created_at)}</span>
        {request.reviewed_by_name && (
          <span><span className="text-faint">Değerlendiren</span> · {request.reviewed_by_name}</span>
        )}
        {request.archived_at && (
          <span className="inline-flex items-center gap-1.5 font-medium text-secondary">
            <Icon name="archive" className="size-3.5" /> Arşivlendi · {formatDateTime(request.archived_at)}
          </span>
        )}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <main className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
            <div className="border-b border-border-subtle px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">Müşteri briefi</h2>
              <p className="mt-0.5 text-xs text-muted">Göreve dönüşecek özgün talep kaydı</p>
            </div>
            <div className="p-4 sm:p-5">
              <p className="max-w-3xl whitespace-pre-wrap text-[14px] leading-6 text-secondary">
                {request.description}
              </p>
              <dl className="mt-6 grid border-t border-border-subtle sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Talebi ileten", request.requested_by_name ?? "Belirtilmedi"],
                  ["Kanal", request.source ?? "Belirtilmedi"],
                  ["Departman", departmentLabel(request.department)],
                  ["İstenen tarih", request.due_date ? formatDateLong(request.due_date) : "Tarih yok"],
                ].map(([label, value], index) => (
                  <div key={label} className={`py-3 sm:px-3 ${index > 0 ? "border-t border-border-subtle sm:border-l sm:border-t-0" : ""}`}>
                    <dt className="text-[10px] font-semibold tracking-wide text-faint">{label.toLocaleUpperCase("tr-TR")}</dt>
                    <dd className="mt-1 text-xs font-medium text-secondary">{value}</dd>
                  </div>
                ))}
              </dl>
              {request.reference_url && (
                <a
                  href={request.reference_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
                >
                  Referans bağlantısını aç <Icon name="arrow-right" className="size-3.5" />
                </a>
              )}
              {attachments.length > 0 && (
                <div className="mt-5 border-t border-border-subtle pt-4">
                  <p className="mb-2 text-[10px] font-semibold tracking-wide text-faint">TALEP GÖRSELLERİ · {attachments.length}</p>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <a href={attachment.file_path} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-xl border border-border-default bg-surface-subtle">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={attachment.file_path} alt={attachment.original_name ?? "Talep görseli"} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]" />
                          <span className="block truncate px-2.5 py-2 text-[11px] font-medium text-secondary">{attachment.original_name ?? "Görseli aç"}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
            <div className="border-b border-border-subtle px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-foreground">
                Değerlendirme notları <span className="font-normal text-muted">· {comments.length}</span>
              </h2>
            </div>
            <div className="p-4 sm:p-5">
              {comments.length > 0 ? (
                <ul className="space-y-4">
                  {comments.map((comment) => (
                    <li key={comment.id} className="flex items-start gap-3">
                      <PersonAvatar name={comment.author_name} avatarPath={comment.author_avatar_path} size="sm" />
                      <div className="min-w-0 flex-1 border-b border-border-subtle pb-4 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">{comment.author_name}</span>
                          <time className="text-[11px] text-faint">{formatDateTime(comment.created_at)}</time>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-5 text-secondary">{comment.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-center text-sm text-muted">Henüz değerlendirme notu yok.</p>
              )}

              <form action={addClientRequestCommentAction} className="mt-5 border-t border-border-subtle pt-4">
                <input type="hidden" name="requestId" value={request.id} />
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
                  Yorum ekle
                  <Textarea name="body" rows={3} required maxLength={2000} placeholder="Eksik bilgi, müşteri dönüşü veya değerlendirme notu…" />
                </label>
                <div className="mt-3 flex justify-end"><SubmitButton>Notu ekle</SubmitButton></div>
              </form>
            </div>
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="rounded-xl border border-border-default bg-surface p-4">
            <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted">KARAR</h2>
            {isOpen ? (
              <div className="mt-4">
                <RequestReviewForm
                  requestId={request.id}
                  department={request.department}
                  assigneeId={request.assignee_id}
                  priority={request.priority}
                  dueDate={request.due_date}
                  people={people}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
                  <span className="text-muted">Durum</span>
                  <Badge tone={CLIENT_REQUEST_STATUS_TONE[request.status]}>{CLIENT_REQUEST_STATUS_LABEL[request.status]}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
                  <span className="text-muted">Atanan</span>
                  <span className="font-medium text-foreground">{request.assignee_name ?? "Henüz yok"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Öncelik</span>
                  <span className="font-medium text-foreground">{TASK_PRIORITY_LABEL[request.priority]}</span>
                </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted">HAREKETLER</h2>
            </div>
            <ActivityFeed entries={activity} showLink={false} emptyText="Bu talepte henüz hareket yok." />
          </section>
        </aside>
      </div>
    </div>
  );
}
