"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import { updateBrandAction } from "@/lib/actions/brands";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { Brand, BrandPersonAssignment, Person } from "@/lib/types";
import BrandLogoPicker from "./BrandLogoPicker";
import ClusterSelect from "./ClusterSelect";
import PersonAvatar from "./PersonAvatar";
import SubmitButton from "./SubmitButton";

const inputClass =
  "w-full rounded-md border border-border-default bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none placeholder:text-faint focus:border-brand-500";

const labelClass = "grid gap-1.5 text-xs font-medium text-secondary";
const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export default function EditBrandForm({
  brand,
  clusters,
  people,
  assignments,
  triggerClassName,
}: {
  brand: Brand;
  clusters: { id: string; label: string }[];
  people: Person[];
  assignments: BrandPersonAssignment[];
  triggerClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(saving);
  const isClient = useIsClient();
  const assignedPersonIds = new Set(assignments.map((assignment) => assignment.person_id));

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (!editing) return;

    function close() {
      if (!savingRef.current) setEditing(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("button")?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [editing]);

  if (!editing) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setEditing(true)}
        aria-haspopup="dialog"
        aria-expanded="false"
        className={triggerClassName ?? "text-xs font-medium text-muted hover:text-brand-600 dark:hover:text-brand-400"}
      >
        Düzenle
      </button>
    );
  }

  if (!isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/65 p-4 pt-8 backdrop-blur-[2px] sm:pt-14">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Pencereyi kapat"
        className="absolute inset-0 cursor-default"
        onClick={() => !savingRef.current && setEditing(false)}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-brand-title"
        className="ui-enter relative w-full max-w-4xl overflow-hidden rounded-xl border border-border-default bg-surface-elevated shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">
              MARKA AYARLARI
            </p>
            <h2 id="edit-brand-title" className="mt-1 truncate text-lg font-semibold tracking-[-0.015em] text-foreground">
              {brand.name} markasını düzenle
            </h2>
            <p className="mt-1 text-xs text-muted">Kimlik, sosyal hesap ve özet bilgilerini güncelle.</p>
          </div>
          <button
            type="button"
            onClick={() => !savingRef.current && setEditing(false)}
            aria-label="Kapat"
            className="ui-press inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <Icon name="close" className="size-[17px]" />
          </button>
        </div>

        <form
          action={async (fd) => {
            setError(null);
            setSaving(true);
            try {
              await updateBrandAction(fd);
              setEditing(false);
            } catch (e) {
              setError(getActionErrorMessage(e));
            } finally {
              setSaving(false);
            }
          }}
          className="max-h-[calc(100dvh-10rem)] space-y-5 overflow-y-auto p-5 sm:p-6"
        >
          <input type="hidden" name="brandId" value={brand.id} />
          <input type="hidden" name="responsibilitySelectionPresent" value="1" />

          <div className="grid items-end gap-4 border-b border-border-subtle pb-5 lg:grid-cols-[11rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className="text-xs font-medium text-secondary">Marka logosu</p>
              <BrandLogoPicker currentLogoPath={brand.logo_path} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className={labelClass}>
                Marka adı
                <input name="name" required defaultValue={brand.name} className={inputClass} />
              </label>
              <label className={labelClass}>
                Kategori
                <ClusterSelect
                  clusters={clusters}
                  defaultValue={
                    clusters.some((c) => c.id === brand.cluster) ? brand.cluster : undefined
                  }
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Instagram
                <input
                  name="instagramHandle"
                  defaultValue={brand.instagram_handle ?? ""}
                  placeholder="kullaniciadi"
                  className={inputClass}
                />
              </label>
            </div>
          </div>

          <div className="space-y-4 border-t border-border-subtle pt-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">Instagram sayıları</h3>
              <p className="mt-1 text-xs text-muted">Takipçi ve gönderi sayılarını haftalık olarak güncelle.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className={labelClass}>
                Takipçi
                <input
                  name="followerCount"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  defaultValue={brand.follower_count ?? ""}
                  placeholder="Örn. 12500"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Gönderi
                <input
                  name="postCount"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  defaultValue={brand.post_count ?? ""}
                  placeholder="Örn. 340"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Tier
                <input
                  name="tier"
                  defaultValue={brand.tier ?? ""}
                  placeholder="Örn. A"
                  className={inputClass}
                />
              </label>
            </div>
            <label className={labelClass}>
              Kısa bilgi
              <textarea
                name="keyFinding"
                rows={3}
                defaultValue={brand.key_finding ?? ""}
                placeholder="Marka hakkında bilinmesi gereken birkaç cümle: ne satıyor, tonu ne, nelere dikkat edilmeli…"
                className={inputClass}
              />
            </label>
          </div>

          <div className="space-y-4 border-t border-border-subtle pt-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">Çekim hakları</h3>
              <p className="mt-1 text-xs text-muted">Sözleşmedeki aylık ve yıllık çekim kotalarını ayrı ayrı tanımla. Boş bırakılan hak tanımlanmamış görünür.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Aylık çekim hakkı
                <input
                  name="monthlyShootAllowance"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  defaultValue={brand.monthly_shoot_allowance ?? ""}
                  placeholder="Örn. 2"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Yıllık çekim hakkı
                <input
                  name="annualShootAllowance"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  defaultValue={brand.annual_shoot_allowance ?? ""}
                  placeholder="Örn. 24"
                  className={inputClass}
                />
              </label>
            </div>
          </div>

          <details className="group border-t border-border-subtle pt-4">
            <summary className="ui-press flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[10px] border border-border-default bg-surface px-3.5 py-2.5 hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider text-secondary">Marka sorumluları</span>
                <span className="mt-0.5 block text-[11px] text-muted">{assignedPersonIds.size > 0 ? `${assignedPersonIds.size} kişi atanmış` : "Henüz sorumlu atanmadı"}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-300">
                Düzenle <Icon name="chevron-down" className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <fieldset className="mt-3 space-y-3">
              <legend className="sr-only">Marka sorumluları</legend>
              <p className="text-xs text-muted">Birden fazla kişi seçebilirsin. Seçimler kişisel marka ve ilerleme analizlerini besler.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {people.map((person) => (
                  <label key={person.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[9px] border border-border-default bg-surface px-2.5 py-2 transition-colors hover:border-border-strong hover:bg-surface-hover has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950/30">
                    <input type="checkbox" name="responsiblePersonId" value={person.id} defaultChecked={assignedPersonIds.has(person.id)} className="size-4 shrink-0 accent-brand-600" />
                    <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="xs" />
                    <span className="min-w-0 truncate text-xs font-semibold text-foreground">{person.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </details>

          <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
            <SubmitButton>Kaydet</SubmitButton>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="text-xs font-medium text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vazgeç
            </button>
            {error && <p role="alert" className="basis-full text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
