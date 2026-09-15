"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { controlClass } from "@/components/ui/Input";
import {
  endBreakAction,
  endWorkAction,
  requestWorkCorrectionAction,
  startBreakAction,
  startWorkAction,
} from "@/lib/actions/worklog";
import { WORK_STATE_LABEL, formatMinutes, type WorkState } from "@/lib/worklog";
import type { WorkSessionView } from "@/lib/repositories/worklog";

const inputClass = controlClass();

const STATE_TONE: Record<WorkState, string> = {
  calismiyor: "bg-zinc-400",
  calisiyor: "bg-emerald-500",
  molada: "bg-amber-500",
  tamamlandi: "bg-sky-500",
};

function istanbulTime(stamp: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(stamp.includes("T") ? stamp : `${stamp.replace(" ", "T")}Z`));
}

/**
 * Günlük mesai kartı. SUNUCU ZAMANI esastır; buradaki sayaç yalnızca
 * gösterimdir ve sayfa açık kaldıkça ilerler — kaydın kendisi tarayıcı
 * kapansa da sunucuda sürer.
 */
export default function WorkLogPanel({
  state,
  open,
  sessions,
  serverNowMinutes,
}: {
  state: WorkState;
  open: WorkSessionView | undefined;
  sessions: WorkSessionView[];
  /** Sunucunun hesapladığı net dakika — sayacın başlangıç değeri. */
  serverNowMinutes: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ticks, setTicks] = useState(0);

  // Yalnızca GÖSTERİM: çalışırken dakika sayacı ilerlesin. Molada dururuyor,
  // çünkü net süre mola boyunca artmıyor.
  useEffect(() => {
    if (state !== "calisiyor") return;
    const timer = setInterval(() => setTicks((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, [state]);

  function act(run: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) { setError(result.error ?? "İşlem tamamlanamadı."); return; }
      setMessage(result.message ?? "Tamam.");
      setTicks(0);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${STATE_TONE[state]}`} />
            <p className="text-sm font-semibold text-foreground">{WORK_STATE_LABEL[state]}</p>
            {open && (
              <p className="text-xs text-muted">
                {istanbulTime(open.started_at)} başladı · net{" "}
                <span className="tabular-nums">
                  {formatMinutes(serverNowMinutes + (state === "calisiyor" ? ticks : 0))}
                </span>
                {open.break_minutes > 0 && ` · mola ${formatMinutes(open.break_minutes)}`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {state === "calismiyor" || state === "tamamlandi" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => startWorkAction())}
                className="ui-press min-h-10 rounded-[9px] bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                Mesaiyi başlat
              </button>
            ) : null}
            {state === "calisiyor" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => startBreakAction())}
                className="ui-press min-h-10 rounded-[9px] border border-border-default bg-surface px-4 text-sm font-semibold text-secondary hover:bg-surface-hover disabled:opacity-50"
              >
                Mola ver
              </button>
            )}
            {state === "molada" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => endBreakAction())}
                className="ui-press min-h-10 rounded-[9px] border border-border-default bg-surface px-4 text-sm font-semibold text-secondary hover:bg-surface-hover disabled:opacity-50"
              >
                Molayı bitir
              </button>
            )}
            {(state === "calisiyor" || state === "molada") && (
              <ActionForm action={endWorkAction} className="inline">
                <SubmitButton
                  pendingLabel="Kapanıyor…"
                  className="ui-press min-h-10 rounded-[9px] border border-border-default bg-surface px-4 text-sm font-semibold text-secondary hover:bg-surface-hover"
                >
                  Günü bitir
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        </div>

        {open?.stale && (
          <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            Bu kayıt uzun süredir açık. Saat otomatik olarak uydurulmaz — günü kapat ve gerekiyorsa
            aşağıdan gerekçeli düzeltme iste.
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
        {message && <p role="status" className="mt-3 text-xs text-success">{message}</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Kendi geçmişin</h2>
          <p className="mt-1 text-xs text-muted">
            Saatler İstanbul saatiyle. Gece yarısını aşan mesai iki güne bölünerek sayılır.
          </p>
        </div>
        <div className="divide-y divide-border-subtle">
          {sessions.map((session) => (
            <details key={session.id} className="px-4 py-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  {istanbulTime(session.started_at)} →{" "}
                  {session.ended_at ? istanbulTime(session.ended_at) : "açık"}
                </span>
                <span className="text-xs tabular-nums text-secondary">
                  net {formatMinutes(session.net_minutes)}
                  {session.break_minutes > 0 && ` · mola ${formatMinutes(session.break_minutes)}`}
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                {session.day_slices.length > 1 && (
                  <p className="text-xs text-muted">
                    Gün dağılımı:{" "}
                    {session.day_slices.map((slice) => `${slice.day}: ${formatMinutes(slice.minutes)}`).join(" · ")}
                  </p>
                )}
                <ActionForm
                  action={requestWorkCorrectionAction}
                  className="grid gap-2 rounded-lg bg-surface-subtle p-3 sm:grid-cols-2"
                  successMessage="Düzeltme isteği iletildi."
                >
                  <input type="hidden" name="sessionId" value={session.id} />
                  <label className="grid gap-1 text-xs font-medium text-secondary">
                    Yeni başlangıç
                    <input name="startedAt" type="datetime-local" className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-secondary">
                    Yeni bitiş
                    <input name="endedAt" type="datetime-local" className={inputClass} />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-secondary sm:col-span-2">
                    Gerekçe
                    <input name="reason" required maxLength={500} className={inputClass} placeholder="Ör. günü kapatmayı unuttum" />
                  </label>
                  <div className="sm:col-span-2">
                    <SubmitButton
                      pendingLabel="Gönderiliyor…"
                      className="min-h-9 rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover"
                    >
                      Düzeltme iste
                    </SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </details>
          ))}
          {sessions.length === 0 && (
            <p className="p-6 text-center text-sm text-muted">Henüz mesai kaydın yok.</p>
          )}
        </div>
      </section>
    </div>
  );
}
