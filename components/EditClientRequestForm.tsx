"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import RequestImagePicker from "@/components/RequestImagePicker";
import SubmitButton from "@/components/SubmitButton";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { updateClientRequestAction } from "@/lib/actions/clientRequests";
import { CONTENT_TYPE_LABEL, CONTENT_TYPES } from "@/lib/constants";
import { DEPARTMENTS } from "@/lib/departments";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { Brand, ClientRequest } from "@/lib/types";

const noSubscribe = () => () => {};

export default function EditClientRequestForm({
  request,
  brands,
}: {
  request: ClientRequest;
  brands: Brand[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useSyncExternalStore(noSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("input, select")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, saving]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-secondary hover:text-brand-600 dark:hover:text-brand-300"
      >
        Düzenle
      </button>
      {open && isClient && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/65 p-4 pt-8 backdrop-blur-[2px] sm:pt-14">
          <button type="button" aria-label="Pencereyi kapat" className="absolute inset-0" onClick={() => !saving && setOpen(false)} />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-request-title" className="ui-enter relative w-full max-w-4xl overflow-hidden rounded-xl border border-border-default bg-surface-elevated shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">TALEP AYARLARI</p>
                <h2 id="edit-request-title" className="mt-1 text-lg font-semibold text-foreground">Müşteri talebini düzenle</h2>
                <p className="mt-1 text-xs text-muted">Briefi ve yeni görsel eklerini güncelle. Reddedilmiş talep yeniden kuyruğa alınır.</p>
              </div>
              <button type="button" aria-label="Kapat" onClick={() => !saving && setOpen(false)} className="ui-press grid size-9 place-items-center rounded-[9px] text-muted hover:bg-surface-hover"><Icon name="close" className="size-4" /></button>
            </div>
            <form
              action={async (formData) => {
                setSaving(true);
                setError(null);
                try {
                  await updateClientRequestAction(formData);
                  setOpen(false);
                } catch (cause) {
                  setError(getActionErrorMessage(cause));
                } finally {
                  setSaving(false);
                }
              }}
              className="grid max-h-[calc(100dvh-9rem)] gap-4 overflow-y-auto p-5 lg:grid-cols-12"
            >
              <input type="hidden" name="requestId" value={request.id} />
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">Marka<Select name="brandId" required defaultValue={request.brand_id}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</Select></label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-5">Talep başlığı<Input name="title" required maxLength={180} defaultValue={request.title} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">Talebi ileten<Input name="requestedByName" maxLength={120} defaultValue={request.requested_by_name ?? ""} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-12">Talep ayrıntısı<Textarea name="description" required maxLength={5000} rows={5} defaultValue={request.description} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">Hedef departman<Select name="department" required defaultValue={request.department}>{DEPARTMENTS.map((department) => <option key={department.id} value={department.id}>{department.label}</option>)}</Select></label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-3">İş türü<Select name="contentType" defaultValue={request.content_type}>{CONTENT_TYPES.map((type) => <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>)}</Select></label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-2">İstenen tarih<Input name="dueDate" type="date" defaultValue={request.due_date ?? ""} /></label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-2">Geliş kanalı<Select name="source" defaultValue={request.source ?? ""}><option value="">Belirtilmedi</option><option>WhatsApp</option><option>E-posta</option><option>Telefon</option><option>Toplantı</option><option>Diğer</option></Select></label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-2">Referans linki<Input name="referenceUrl" type="url" defaultValue={request.reference_url ?? ""} /></label>
              <RequestImagePicker />
              <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4 lg:col-span-12">
                <SubmitButton>Değişiklikleri kaydet</SubmitButton>
                <button type="button" disabled={saving} onClick={() => setOpen(false)} className="text-xs font-medium text-muted hover:text-foreground">Vazgeç</button>
                {error && <p role="alert" className="basis-full text-xs text-danger">{error}</p>}
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
