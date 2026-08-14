"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import RequestImagePicker from "@/components/RequestImagePicker";
import SubmitButton from "@/components/SubmitButton";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { createClientRequestAction } from "@/lib/actions/clientRequests";
import { CONTENT_TYPE_LABEL, CONTENT_TYPES } from "@/lib/constants";
import { DEPARTMENTS } from "@/lib/departments";
import type { Brand } from "@/lib/types";

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function ClientRequestCreateDialog({
  brands,
}: {
  brands: Pick<Brand, "id" | "name">[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function close() {
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLSelectElement>('select[name="brandId"]')?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <Button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="plus" className="size-4" />
        Yeni talep
      </Button>

      {open && isClient && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/65 p-3 pt-6 backdrop-blur-[2px] sm:p-6 sm:pt-12">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Yeni talep penceresini kapat"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-client-request-title"
            aria-describedby="new-client-request-description"
            className="ui-enter relative w-full max-w-5xl overflow-hidden rounded-xl border border-border-default bg-surface-elevated shadow-2xl outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">YENİ KAYIT</p>
                <h2 id="new-client-request-title" className="mt-1 text-lg font-semibold tracking-[-0.015em] text-foreground">Yeni müşteri talebi</h2>
                <p id="new-client-request-description" className="mt-1 text-xs leading-5 text-muted">Briefi bir kez kaydet; proje ve görev onaylandığında otomatik oluşsun.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="ui-press inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] text-muted hover:bg-surface-hover hover:text-foreground">
                <Icon name="close" className="size-[17px]" />
              </button>
            </header>

            <form action={createClientRequestAction} className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-12">
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                  Marka
                  <Select name="brandId" required defaultValue="">
                    <option value="" disabled>Marka seç</option>
                    {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-8">
                  Talep başlığı
                  <Input name="title" required maxLength={180} placeholder="Örn. Eylül lansman filmi revizesi" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-12">
                  Talep ayrıntısı
                  <Textarea name="description" required maxLength={5000} rows={5} placeholder="İstenen çıktı, ölçüler, mesaj, zorunlu detaylar ve varsa revize notları…" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                  Hedef departman
                  <Select name="department" required defaultValue="">
                    <option value="" disabled>Departman seç</option>
                    {DEPARTMENTS.map((department) => <option key={department.id} value={department.id}>{department.label}</option>)}
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                  İş türü
                  <Select name="contentType" defaultValue="Diger">
                    {CONTENT_TYPES.map((type) => <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>)}
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                  İstenen tarih
                  <Input name="dueDate" type="date" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                  Talebi ileten
                  <Input name="requestedByName" maxLength={120} placeholder="Müşteri / kişi adı" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                  Geliş kanalı
                  <Select name="source" defaultValue="">
                    <option value="">Belirtilmedi</option>
                    <option>WhatsApp</option><option>E-posta</option><option>Telefon</option><option>Toplantı</option><option>Diğer</option>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-4">
                  Referans linki
                  <Input name="referenceUrl" type="url" placeholder="https://…" />
                </label>
                <RequestImagePicker />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4">
                <button type="button" onClick={() => setOpen(false)} className="ui-press min-h-10 rounded-[10px] px-4 text-[13px] font-semibold text-secondary hover:bg-surface-hover">
                  Vazgeç
                </button>
                <SubmitButton pendingLabel="Gönderiliyor…">Talebi değerlendirmeye gönder</SubmitButton>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
