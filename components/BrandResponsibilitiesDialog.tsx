"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import ActionForm from "@/components/ActionForm";
import BrandLogo from "@/components/BrandLogo";
import PersonAvatar from "@/components/PersonAvatar";
import SubmitButton from "@/components/SubmitButton";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { saveBrandPersonAssignmentsAction } from "@/lib/actions/people";
import type { Brand, Person, PersonBrandAssignment } from "@/lib/types";

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function BrandResponsibilitiesDialog({
  brands,
  people,
  assignments,
}: {
  brands: Pick<Brand, "id" | "name" | "logo_path">[];
  people: Pick<Person, "id" | "name" | "title" | "avatar_path" | "department">[];
  assignments: PersonBrandAssignment[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState(brands[0]?.id ?? "");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();

  const filteredBrands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return normalized
      ? brands.filter((brand) => brand.name.toLocaleLowerCase("tr-TR").includes(normalized))
      : brands;
  }, [brands, query]);
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? brands[0];
  const assignedPersonIds = new Set(
    assignments.filter((item) => item.brand_id === selectedBrand?.id).map((item) => item.person_id),
  );
  const assignmentCountByBrand = new Map(
    brands.map((brand) => [
      brand.id,
      assignments.filter((item) => item.brand_id === brand.id).length,
    ]),
  );

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={brands.length === 0}
        aria-haspopup="dialog"
      >
        <Icon name="team" className="size-4" />
        Marka sorumluları
      </Button>

      {open && isClient && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/65 p-3 pt-6 backdrop-blur-[2px] sm:p-6 sm:pt-12">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Marka sorumluları penceresini kapat"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="brand-responsibilities-title"
            className="ui-enter relative w-full max-w-5xl overflow-hidden rounded-xl border border-border-default bg-surface-elevated shadow-2xl outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">PORTFÖY DAĞILIMI</p>
                <h2 id="brand-responsibilities-title" className="mt-1 text-lg font-semibold tracking-[-0.015em] text-foreground">Marka sorumlularını yönet</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Bir markaya birden fazla sorumlu atayabilirsin. Bu seçimler ekip erişimini kısıtlamaz; kişisel marka ve ilerleme analizlerini besler.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="ui-press inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] text-muted hover:bg-surface-hover hover:text-foreground">
                <Icon name="close" className="size-[17px]" />
              </button>
            </header>

            <div className="grid max-h-[calc(100dvh-9rem)] min-h-[32rem] overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-b border-border-subtle bg-surface-subtle lg:border-b-0 lg:border-r">
                <label className="border-b border-border-subtle p-3">
                  <span className="sr-only">Marka ara</span>
                  <span className="relative block">
                    <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Marka ara…" className="min-h-10 w-full rounded-[9px] border border-border-default bg-surface pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-faint focus:border-brand-500" />
                  </span>
                </label>
                <div className="min-h-0 overflow-y-auto p-2">
                  {filteredBrands.map((brand) => {
                    const selected = selectedBrand?.id === brand.id;
                    const count = assignmentCountByBrand.get(brand.id) ?? 0;
                    return (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => setSelectedBrandId(brand.id)}
                        aria-pressed={selected}
                        className={`flex min-h-12 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors ${selected ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200" : "text-secondary hover:bg-surface-hover"}`}
                      >
                        <BrandLogo name={brand.name} logoPath={brand.logo_path} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{brand.name}</span>
                        <span className="text-[10px] tabular-nums text-muted">{count}</span>
                      </button>
                    );
                  })}
                  {filteredBrands.length === 0 && <p className="px-3 py-8 text-center text-xs text-muted">Aramayla eşleşen marka yok.</p>}
                </div>
              </aside>

              <main className="min-h-0 overflow-y-auto p-4 sm:p-6">
                {selectedBrand ? (
                  <ActionForm
                    key={`${selectedBrand.id}:${[...assignedPersonIds].sort().join(",")}`}
                    action={saveBrandPersonAssignmentsAction}
                    successMessage="Marka sorumluları kaydedildi."
                    className="space-y-5"
                  >
                    <input type="hidden" name="brandId" value={selectedBrand.id} />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <BrandLogo name={selectedBrand.name} logoPath={selectedBrand.logo_path} size="lg" />
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-foreground">{selectedBrand.name}</h3>
                          <p className="mt-0.5 text-xs text-muted">{assignedPersonIds.size > 0 ? `${assignedPersonIds.size} sorumlu atanmış` : "Henüz sorumlu atanmadı"}</p>
                        </div>
                      </div>
                      <SubmitButton pendingLabel="Kaydediliyor…">Değişiklikleri kaydet</SubmitButton>
                    </div>

                    <fieldset>
                      <legend className="text-xs font-semibold uppercase tracking-wider text-secondary">Ekip üyeleri</legend>
                      <p className="mt-1 text-xs text-muted">Bu marka üzerinde düzenli sorumluluğu bulunan herkesi seç.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {people.map((person) => (
                          <label key={person.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] border border-border-default bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-hover has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950/30">
                            <input type="checkbox" name="personId" value={person.id} defaultChecked={assignedPersonIds.has(person.id)} className="size-4 shrink-0 accent-brand-600" />
                            <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-foreground">{person.name}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-muted">{person.title ?? person.department ?? "Ekip üyesi"}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </ActionForm>
                ) : <p className="text-sm text-muted">Yönetilecek aktif marka bulunmuyor.</p>}
              </main>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
