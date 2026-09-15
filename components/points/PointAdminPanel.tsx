"use client";

import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { controlClass } from "@/components/ui/Input";
import {
  assignPointProfileAction,
  recordExtraPointAction,
  recordManagerPointAction,
  reversePointEntryAction,
} from "@/lib/actions/points";
import {
  EXTRA_POINT_ITEMS,
  POINT_PROFILES,
  POINT_PROFILE_LABEL,
  type PointProfile,
} from "@/lib/points/catalog";
import { formatUnitsAsPoints, unitsToPoints } from "@/lib/points/units";
import type { PointLedgerRow } from "@/lib/repositories/pointLedger";

const inputClass = controlClass();

const TABS = [
  { id: "profil", label: "Puan profilleri" },
  { id: "ek", label: "Ek puan" },
  { id: "yonetici", label: "Yönetici puanı" },
  { id: "duzeltme", label: "Düzeltme" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Puanlamanın YÖNETİCİ işlemleri. Bunlar olmadan katalog motoru kullanılamaz:
 * profil atanmayan kişi paket alamaz, ek puanlar (çekim, toplantı, uygulanan
 * fikir) hiçbir yerden girilemez ve yanlış kayıt düzeltilemezdi.
 */
export default function PointAdminPanel({
  people,
  profiles,
  month,
  ledger,
}: {
  people: { id: string; name: string }[];
  profiles: Record<string, PointProfile | undefined>;
  month: string;
  /** Bu ayın hareketleri — düzeltme sekmesi buradan seçim yaptırıyor. */
  ledger: (PointLedgerRow & { person_name: string })[];
}) {
  const [tab, setTab] = useState<TabId>("profil");
  const fixedExtras = EXTRA_POINT_ITEMS.filter((item) => item.units !== null);
  const reversible = ledger.filter((row) => row.source_type !== "correction");

  return (
    <section className="rounded-xl border border-border-default bg-surface">
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Puan yönetimi</h2>
        <p className="mt-1 text-xs text-muted">
          Profil ataması, ek puan havuzu ve düzeltmeler. Yanlış kayıt silinmez; gerekçeli ters
          kayıtla düzeltilir.
        </p>
        <nav aria-label="Puan yönetimi bölümleri" className="mt-3 flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`ui-press min-h-9 rounded-[9px] px-3 text-xs font-semibold ${
                tab === item.id ? "bg-brand-600 text-white" : "text-secondary hover:bg-surface-hover"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "profil" && (
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted">
            Profil AÇIKÇA atanır; departman ya da isimden tahmin edilmez. Değişiklik yalnızca
            yürürlük ayından sonrasını etkiler, geçmiş hak edişler yeniden fiyatlanmaz.
          </p>
          <ActionForm
            action={assignPointProfileAction}
            className="grid gap-3 rounded-lg bg-surface-subtle p-3 sm:grid-cols-4"
          >
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Kişi
              <select name="personId" required className={inputClass}>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {profiles[person.id] ? ` · ${POINT_PROFILE_LABEL[profiles[person.id]!]}` : " · profil yok"}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Profil
              <select name="profile" required className={inputClass}>
                {POINT_PROFILES.map((value) => (
                  <option key={value} value={value}>{POINT_PROFILE_LABEL[value]}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Yürürlük ayı
              <input name="effectiveFromMonth" type="month" defaultValue={month} required className={inputClass} />
            </label>
            <div className="flex items-end">
              <SubmitButton pendingLabel="Atanıyor…">Profili ata</SubmitButton>
            </div>
          </ActionForm>

          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {people.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-3 py-1.5">
                <span className="truncate text-secondary">{person.name}</span>
                <span className={profiles[person.id] ? "font-medium text-foreground" : "text-warning"}>
                  {profiles[person.id] ? POINT_PROFILE_LABEL[profiles[person.id]!] : "profil atanmadı"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "ek" && (
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted">
            Sabit fiyatlı kalemler. Çekim kişi + yerel takvim günü başına TEK yazılır; gün
            bölünmez ve aynı gün farklı markalarla çoğaltılamaz. Temel iş ile plan dışı ek iş
            aynı çıktı için iki kez yazılmaz.
          </p>
          <ActionForm
            action={recordExtraPointAction}
            className="grid gap-3 rounded-lg bg-surface-subtle p-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Kişi
              <select name="personId" required className={inputClass}>
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Kalem
              <select name="itemKey" required className={inputClass}>
                {fixedExtras.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label} · {formatUnitsAsPoints(item.units!)} puan
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Tarih
              <input name="occurredOn" type="date" required className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Kanıt / referans <span className="font-normal text-muted">(çekimde gerekmez)</span>
              <input name="referenceId" maxLength={120} className={inputClass} placeholder="Teslim, olay ya da fikir kimliği" />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary sm:col-span-2 lg:col-span-3">
              Açıklama <span className="font-normal text-muted">(opsiyonel)</span>
              <input name="reason" maxLength={500} className={inputClass} />
            </label>
            <div className="flex items-end">
              <SubmitButton pendingLabel="Yazılıyor…">Ek puanı yaz</SubmitButton>
            </div>
          </ActionForm>

          <ul className="space-y-1 text-[11px] text-muted">
            {fixedExtras.map((item) => (
              <li key={item.key}>
                <span className="font-semibold text-secondary">{item.label}</span> · {item.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "yonetici" && (
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted">
            Katalogdaki TEK serbest tutarlı kalem. Açıklama zorunlu; tutar 0,05 puanın katı
            olmalı. Diğer kalemler sabit fiyat × doğrulanmış adetle hesaplanır.
          </p>
          <ActionForm
            action={recordManagerPointAction}
            className="grid gap-3 rounded-lg bg-surface-subtle p-3 sm:grid-cols-4"
          >
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Kişi
              <select name="personId" required className={inputClass}>
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Dönem
              <input name="period" type="month" defaultValue={month} required className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-secondary">
              Puan <span className="font-normal text-muted">(0,05 adımlı)</span>
              <input name="points" required inputMode="decimal" className={inputClass} placeholder="Ör. 2,5" />
            </label>
            <div className="flex items-end">
              <SubmitButton pendingLabel="Yazılıyor…">Puanı yaz</SubmitButton>
            </div>
            <label className="grid gap-1.5 text-xs font-medium text-secondary sm:col-span-4">
              Açıklama <span className="font-normal text-danger">(zorunlu)</span>
              <input name="reason" required maxLength={500} className={inputClass} />
            </label>
          </ActionForm>
        </div>
      )}

      {tab === "duzeltme" && (
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted">
            Yanlış kayıt SİLİNMEZ: gerekçeli ters kayıt yazılır ve ikisi de raporda görünür.
            Bir kayıt yalnızca bir kez terslenebilir.
          </p>
          {reversible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-default px-3 py-4 text-center text-xs text-muted">
              {month} döneminde terslenebilecek bir puan hareketi yok.
            </p>
          ) : (
            <ActionForm
              action={reversePointEntryAction}
              className="grid gap-3 rounded-lg bg-surface-subtle p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Kayıt
                <select name="entryId" required className={inputClass}>
                  {reversible.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.person_name} · {row.item_key ?? row.source_type} ·{" "}
                      {unitsToPoints(row.amount_units)} puan
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Gerekçe <span className="font-normal text-danger">(zorunlu)</span>
                <input name="reason" required maxLength={500} className={inputClass} />
              </label>
              <div className="flex items-end">
                <SubmitButton
                  pendingLabel="Yazılıyor…"
                  className="min-h-10 rounded-[9px] border border-border-default bg-surface px-3 text-sm font-semibold text-danger hover:bg-surface-hover"
                >
                  Ters kayıt yaz
                </SubmitButton>
              </div>
            </ActionForm>
          )}
        </div>
      )}
    </section>
  );
}
