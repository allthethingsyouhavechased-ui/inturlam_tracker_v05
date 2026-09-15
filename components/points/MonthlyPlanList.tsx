"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SubmitButton from "@/components/SubmitButton";
import { controlClass } from "@/components/ui/Input";
import { CONTENT_TYPES, CONTENT_TYPE_LABEL } from "@/lib/constants";
import {
  deleteMonthlyPlanAction,
  runMonthlyPlansAction,
  saveMonthlyPlanAction,
  setMonthlyPlanPausedAction,
} from "@/lib/actions/monthlyPlans";
import { DEFAULT_TITLE_PATTERN } from "@/lib/monthlyPlan";
import {
  POINT_PROFILES,
  POINT_PROFILE_LABEL,
  catalogItemsForProfile,
  type PointProfile,
} from "@/lib/points/catalog";
import type { MonthlyTaskPlanView } from "@/lib/repositories/monthlyPlans";

const inputClass = controlClass();

/**
 * Aylık otomasyon planları. Plan duraklatılabilir; değişiklik yalnızca
 * GELECEKTEKİ paketleri etkiler. Gerçek zamanlayıcı yalnızca canlıda ve tek
 * sahiplikle çalışır — buradaki "şimdi çalıştır" düğmesi kesinti sonrası bu
 * ayın eksiğini tamamlamak içindir ve aynı ayı ikinci kez üretmez.
 */
export default function MonthlyPlanList({
  plans,
  brands,
  people,
  defaultMonth,
}: {
  plans: MonthlyTaskPlanView[];
  brands: { id: string; name: string }[];
  people: { id: string; name: string }[];
  defaultMonth: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<PointProfile>("video");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(run: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) { setError(result.error ?? "İşlem tamamlanamadı."); return; }
      setMessage(result.message ?? "Tamam.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border-default bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Aylık otomasyon planları</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Sunucu, İstanbul saatiyle günlük kontrolde zamanı gelen paketleri açar; eski işlerin
            bitmesini beklemez. Geçmiş aylara sessizce görev yığılmaz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => runMonthlyPlansAction())}
            className="ui-press min-h-9 rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover disabled:opacity-50"
          >
            Bu ayın eksiğini tamamla
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="ui-press min-h-9 rounded-[9px] bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500"
          >
            {open ? "Formu kapat" : "Yeni plan"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="px-4 pt-3 text-xs text-danger">{error}</p>}
      {message && <p role="status" className="px-4 pt-3 text-xs text-success">{message}</p>}

      {open && (
        <form
          action={(formData) => act(async () => saveMonthlyPlanAction(formData))}
          className="grid gap-3 border-b border-border-subtle p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Plan adı
            <input name="label" required maxLength={200} className={inputClass} placeholder="Ör. Marka X aylık Reels" />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Marka
            <select name="brandId" required className={inputClass}>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Sorumlu
            <select name="assigneeId" required className={inputClass}>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Puan profili
            <select
              name="profile"
              value={profile}
              onChange={(event) => setProfile(event.target.value as PointProfile)}
              className={inputClass}
            >
              {POINT_PROFILES.map((value) => (
                <option key={value} value={value}>{POINT_PROFILE_LABEL[value]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Katalog kalemi
            <select name="itemKey" required className={inputClass}>
              {catalogItemsForProfile(profile).map((item) => (
                <option key={item.key} value={item.key}>{item.label} · {item.requiredCount} adet</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Görev türü
            <select name="contentType" required defaultValue="Reel" className={inputClass}>
              {CONTENT_TYPES.map((type) => <option key={type} value={type}>{CONTENT_TYPE_LABEL[type]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Adet
            <input name="itemCount" type="number" min={1} max={60} defaultValue={4} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Başlangıç ayı
            <input name="startMonth" type="month" defaultValue={defaultMonth} required className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary">
            Üretim günü <span className="font-normal text-muted">(varsayılan: ayın 1&apos;i)</span>
            <input name="generationDay" type="number" min={1} max={28} defaultValue={1} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-secondary sm:col-span-2">
            Başlık kalıbı
            <input name="titlePattern" defaultValue={DEFAULT_TITLE_PATTERN} required maxLength={200} className={inputClass} />
          </label>
          <label className="flex items-end gap-2 text-xs font-medium text-secondary">
            <input name="paused" type="checkbox" value="1" className="size-4" />
            Duraklatılmış başlat
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton pendingLabel="Kaydediliyor…">Planı kaydet</SubmitButton>
          </div>
        </form>
      )}

      <div className="divide-y divide-border-subtle">
        {plans.map((plan) => (
          <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {plan.label}
                {plan.paused === 1 && (
                  <span className="ml-2 rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
                    duraklatıldı
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted">
                {plan.brand_name ?? "Marka yok"} · {POINT_PROFILE_LABEL[plan.profile]} · {plan.item_key} ·
                {" "}{plan.item_count} iş · ayın {plan.generation_day}. günü · sorumlu {plan.assignee_name ?? "atanmadı"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {plan.last_run_at
                  ? `Son çalışma: ${plan.last_run_month} · ${plan.last_run_status}`
                  : "Henüz çalışmadı"}
                {plan.last_run_error && <span className="text-danger"> · {plan.last_run_error}</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => setMonthlyPlanPausedAction(plan.id, plan.paused !== 1))}
                className="touch-target text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300 disabled:opacity-50"
              >
                {plan.paused === 1 ? "Devam ettir" : "Duraklat"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => deleteMonthlyPlanAction(plan.id))}
                className="touch-target text-xs font-semibold text-danger hover:underline disabled:opacity-50"
              >
                Sil
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            Tanımlı aylık plan yok. Otomasyon isteğe bağlıdır; plan olmadan hiçbir görev kendiliğinden üretilmez.
          </p>
        )}
      </div>
    </section>
  );
}
