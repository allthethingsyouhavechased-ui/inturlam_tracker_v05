import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import SubmitButton from "@/components/SubmitButton";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { createClientRequestAction } from "@/lib/actions/clientRequests";
import {
  CLIENT_REQUEST_STATUSES,
  CLIENT_REQUEST_STATUS_DOT,
  CLIENT_REQUEST_STATUS_LABEL,
  CLIENT_REQUEST_STATUS_TONE,
} from "@/lib/clientRequests";
import { CONTENT_TYPE_LABEL, CONTENT_TYPES } from "@/lib/constants";
import { DEPARTMENTS, departmentLabel } from "@/lib/departments";
import { formatDateLong, formatDateTime } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { canReviewClientRequests } from "@/lib/requestAccess";
import { listBrands } from "@/lib/repositories/brands";
import { listClientRequestsForPerson } from "@/lib/repositories/clientRequests";
import type { ClientRequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function isRequestStatus(value: unknown): value is ClientRequestStatus {
  return CLIENT_REQUEST_STATUSES.includes(value as ClientRequestStatus);
}

export default async function ClientRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const person = await requirePageSession();
  const canReview = canReviewClientRequests(person);
  const allRequests = listClientRequestsForPerson(person.id, canReview);
  const brands = listBrands();
  const sp = await searchParams;
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
        title={canReview ? "Ön talep onayı" : "Talep merkezi"}
        description={
          canReview
            ? "Müşteriden gelen işi değerlendir, doğru ekibe ata ve hazır olduğunda tek adımda göreve dönüştür."
            : "Müşteriden gelen işi kaydet; değerlendirme ve göreve dönüşme sürecini buradan izle."
        }
        actions={
          <a href="#yeni-talep" className={buttonClass()}>
            <Icon name="plus" className="size-4" /> Yeni talep
          </a>
        }
      />

      <section className="mb-6 grid grid-cols-2 border-y border-border-subtle sm:grid-cols-4" aria-label="Talep özeti">
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
      </section>

      <details
        id="yeni-talep"
        open={allRequests.length === 0}
        className="group mb-7 scroll-mt-20 rounded-xl border border-border-default bg-surface"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
          <span>
            <span className="block text-sm font-semibold text-foreground">Yeni müşteri talebi</span>
            <span className="mt-0.5 block text-xs text-muted">Briefi bir kez kaydet; proje ve görev onayda otomatik oluşsun.</span>
          </span>
          <Icon name="chevron-down" className="size-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <form action={createClientRequestAction} className="border-t border-border-subtle p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-12">
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
              Marka
              <Select name="brandId" required defaultValue="">
                <option value="" disabled>Marka seç</option>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-5">
              Talep başlığı
              <Input name="title" required maxLength={180} placeholder="Örn. Eylül lansman filmi revizesi" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">
              Talebi ileten
              <Input name="requestedByName" maxLength={120} placeholder="Müşteri / kişi adı" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-12">
              Talep ayrıntısı
              <Textarea name="description" required maxLength={5000} rows={5} placeholder="İstenen çıktı, ölçüler, mesaj, zorunlu detaylar ve varsa revize notları…" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">
              Hedef departman
              <Select name="department" required defaultValue="">
                <option value="" disabled>Departman seç</option>
                {DEPARTMENTS.map((department) => <option key={department.id} value={department.id}>{department.label}</option>)}
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">
              İş türü
              <Select name="contentType" defaultValue="Diger">
                {CONTENT_TYPES.map((type) => <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>)}
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-2">
              İstenen tarih
              <Input name="dueDate" type="date" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-2">
              Geliş kanalı
              <Select name="source" defaultValue="">
                <option value="">Belirtilmedi</option>
                <option>WhatsApp</option><option>E-posta</option><option>Telefon</option><option>Toplantı</option><option>Diğer</option>
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-2">
              Referans linki
              <Input name="referenceUrl" type="url" placeholder="https://…" />
            </label>
          </div>
          <div className="mt-5 flex justify-end border-t border-border-subtle pt-4">
            <SubmitButton>Talebi değerlendirmeye gönder</SubmitButton>
          </div>
        </form>
      </details>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{canReview ? "Değerlendirme kuyruğu" : "Taleplerim"}</h2>
            <p className="mt-0.5 text-xs text-muted">{requests.length} kayıt gösteriliyor</p>
          </div>
          {selectedStatus && (
            <Link href="/requests" className="text-xs font-semibold text-brand-600 hover:underline">Tüm durumları göster</Link>
          )}
        </div>

        {requests.length === 0 ? (
          <EmptyState
            compact
            title="Bu görünümde talep yok"
            description={selectedStatus ? "Başka bir durum seçebilir veya yeni talep ekleyebilirsin." : "İlk müşteri talebini yukarıdaki formdan kaydet."}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface">
            {requests.map((request, index) => (
              <Link
                key={request.id}
                href={`/requests/${request.id}`}
                className={`group grid min-h-[82px] gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover sm:grid-cols-[minmax(0,1fr)_11rem_9rem_1.5rem] sm:items-center sm:px-5 ${index > 0 ? "border-t border-border-subtle" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${CLIENT_REQUEST_STATUS_DOT[request.status]}`} />
                    <h3 className="truncate text-[13px] font-semibold text-foreground">{request.title}</h3>
                  </div>
                  <p className="mt-1 truncate pl-4 text-xs text-muted">
                    <span className="font-medium text-secondary">{request.brand_name}</span>
                    <span aria-hidden="true"> · </span>{CONTENT_TYPE_LABEL[request.content_type]}
                    {canReview && <><span aria-hidden="true"> · </span>{request.created_by_name}</>}
                  </p>
                </div>
                <div className="pl-4 text-xs sm:pl-0">
                  <span className="block text-[10px] font-semibold tracking-wide text-faint">DEPARTMAN</span>
                  <span className="mt-1 block font-medium text-secondary">{departmentLabel(request.department)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 pl-4 sm:block sm:pl-0">
                  <Badge tone={CLIENT_REQUEST_STATUS_TONE[request.status]}>{CLIENT_REQUEST_STATUS_LABEL[request.status]}</Badge>
                  <span className="text-[11px] text-muted sm:mt-1.5 sm:block">{request.due_date ? formatDateLong(request.due_date) : formatDateTime(request.created_at)}</span>
                </div>
                <Icon name="chevron-right" className="hidden size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-secondary sm:block" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
