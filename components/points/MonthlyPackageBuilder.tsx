"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SubmitButton from "@/components/SubmitButton";
import { controlClass } from "@/components/ui/Input";
import { CONTENT_TYPES, CONTENT_TYPE_LABEL } from "@/lib/constants";
import { createMonthlyPackageAction } from "@/lib/actions/monthlyPlans";
import {
  DEFAULT_TITLE_PATTERN,
  renderTitlePattern,
  suggestedDueDates,
} from "@/lib/monthlyPlan";
import {
  POINT_PROFILES,
  POINT_PROFILE_LABEL,
  catalogItem,
  catalogItemsForProfile,
  packageUnitsFor,
  type PointProfile,
} from "@/lib/points/catalog";
import { formatUnitsAsPoints } from "@/lib/points/units";
import type { Brand, ContentType, Person } from "@/lib/types";

const inputClass = controlClass();

interface Row {
  title: string;
  dueDate: string;
  contentType: ContentType;
  assigneeId: string;
}

/**
 * Katalog kalemine bağlı toplu görev oluşturucu.
 *
 * Dört görev = DÖRT BAĞIMSIZ İÇERİK; tek işin dört aşaması değil. Tarihler
 * (7/14/21/ayın sonu) yalnızca ÖNERİDİR — her satır kaydetmeden önce burada
 * düzenlenebilir. Kaydetme tek transaction'da yapılır: yarım paket kalmaz.
 */
export default function MonthlyPackageBuilder({
  brands,
  people,
  defaultMonth,
}: {
  brands: Pick<Brand, "id" | "name">[];
  people: Pick<Person, "id" | "name">[];
  defaultMonth: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<PointProfile>("video");
  const [itemKey, setItemKey] = useState(catalogItemsForProfile("video")[0]?.key ?? "");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [contentType, setContentType] = useState<ContentType>("Reel");
  const [titlePattern, setTitlePattern] = useState(DEFAULT_TITLE_PATTERN);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const items = useMemo(() => catalogItemsForProfile(profile), [profile]);
  const item = catalogItem(profile, itemKey) ?? items[0];
  const brandName = brands.find((brand) => brand.id === brandId)?.name ?? "";
  const [count, setCount] = useState(item?.requiredCount ?? 4);

  function buildPreview() {
    setError(null);
    setMessage(null);
    if (!item) { setError("Katalog kalemi seçilmeli."); return; }
    if (!brandId) { setError("Marka seçilmeli."); return; }
    if (count < item.requiredCount) {
      setError(`Bu kalem ${item.requiredCount} iş gerektiriyor; adet daha az olamaz.`);
      return;
    }
    let dates: string[];
    try { dates = suggestedDueDates(month, count); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Ay geçersiz."); return; }
    setRows(dates.map((dueDate, index) => ({
      title: renderTitlePattern(titlePattern, { index: index + 1, month, brandName }),
      dueDate,
      contentType,
      assigneeId: personId,
    })));
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((current) => current?.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)) ?? null);
  }

  return (
    <section className="space-y-4 rounded-xl border border-border-default bg-surface p-4 sm:p-5">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-base font-semibold text-foreground">Aylık paket oluştur</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Katalog kalemine bağlı toplu üretim. Üretilen işler <strong>bağımsız içeriklerdir</strong>: her biri
          kendi teslim sürümüne ve onayına sahiptir; aylık takip için tek puan paketinde gruplanır.
          Tarihler yalnızca öneridir, aşağıda satır satır değiştirilebilir.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Puan profili
          <select
            value={profile}
            onChange={(event) => {
              const next = event.target.value as PointProfile;
              setProfile(next);
              const first = catalogItemsForProfile(next)[0];
              setItemKey(first?.key ?? "");
              setCount(first?.requiredCount ?? 4);
              setRows(null);
            }}
            className={inputClass}
          >
            {POINT_PROFILES.map((value) => (
              <option key={value} value={value}>{POINT_PROFILE_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Katalog kalemi
          <select
            value={item?.key ?? ""}
            onChange={(event) => {
              setItemKey(event.target.value);
              const next = catalogItem(profile, event.target.value);
              setCount(next?.requiredCount ?? 4);
              setRows(null);
            }}
            className={inputClass}
          >
            {items.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label} · {option.requiredCount} adet · {formatUnitsAsPoints(packageUnitsFor(option))} puan
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Marka
          <select value={brandId} onChange={(event) => { setBrandId(event.target.value); setRows(null); }} className={inputClass}>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Hak sahibi
          <select value={personId} onChange={(event) => { setPersonId(event.target.value); setRows(null); }} className={inputClass}>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Plan ayı
          <input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setRows(null); }} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Adet
          <input
            type="number"
            min={item?.requiredCount ?? 1}
            max={60}
            value={count}
            onChange={(event) => { setCount(Number(event.target.value)); setRows(null); }}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Görev türü
          <select value={contentType} onChange={(event) => { setContentType(event.target.value as ContentType); setRows(null); }} className={inputClass}>
            {CONTENT_TYPES.map((type) => <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary lg:col-span-2">
          Başlık kalıbı <span className="font-normal text-muted">{"{n} sıra · {ay} plan ayı · {marka} marka adı"}</span>
          <input value={titlePattern} onChange={(event) => { setTitlePattern(event.target.value); setRows(null); }} maxLength={200} className={inputClass} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={buildPreview}
          className="ui-press min-h-10 rounded-[9px] border border-border-default bg-surface px-3 text-sm font-semibold text-secondary hover:bg-surface-hover"
        >
          Önizlemeyi oluştur
        </button>
        {item && (
          <p className="text-xs text-muted">
            Tamamlanınca <strong>{formatUnitsAsPoints(packageUnitsFor(item))} puan</strong> · paket
            tamamlanmadan puan doğmaz.
          </p>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {message && <p role="status" className="text-xs text-success">{message}</p>}

      {rows && (
        <form
          action={(formData) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await createMonthlyPackageAction(formData);
              if (!result.ok) { setError(result.error); return; }
              setMessage(result.message ?? "Paket oluşturuldu.");
              setRows(null);
              router.refresh();
            });
          }}
          className="space-y-3 border-t border-border-subtle pt-4"
        >
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="profile" value={profile} />
          <input type="hidden" name="itemKey" value={item?.key ?? ""} />
          <input type="hidden" name="planMonth" value={month} />
          <input type="hidden" name="personId" value={personId} />
          <input type="hidden" name="contentType" value={contentType} />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-[0.08em] text-muted">
                  <th className="px-2 py-1 font-medium">#</th>
                  <th className="px-2 py-1 font-medium">Başlık</th>
                  <th className="px-2 py-1 font-medium">Teslim tarihi</th>
                  <th className="px-2 py-1 font-medium">Tür</th>
                  <th className="px-2 py-1 font-medium">Sorumlu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-border-subtle">
                    <td className="px-2 py-1.5 text-xs text-muted tabular-nums">{index + 1}</td>
                    <td className="px-2 py-1.5">
                      <input
                        name="rowTitle"
                        value={row.title}
                        onChange={(event) => updateRow(index, { title: event.target.value })}
                        required
                        maxLength={200}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        name="rowDueDate"
                        type="date"
                        value={row.dueDate}
                        onChange={(event) => updateRow(index, { dueDate: event.target.value })}
                        required
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        name="rowContentType"
                        value={row.contentType}
                        onChange={(event) => updateRow(index, { contentType: event.target.value as ContentType })}
                        className={inputClass}
                      >
                        {CONTENT_TYPES.map((type) => <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        name="rowAssigneeId"
                        value={row.assigneeId}
                        onChange={(event) => updateRow(index, { assigneeId: event.target.value })}
                        className={inputClass}
                      >
                        {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Oluşturuluyor…">
              {rows.length} işi ve paketi oluştur
            </SubmitButton>
            {pending && <span className="text-xs text-muted">Kaydediliyor…</span>}
          </div>
        </form>
      )}
    </section>
  );
}
