"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  endBreakAction,
  endWorkAction,
  startBreakAction,
  startWorkAction,
} from "@/lib/actions/worklog";
import { loadWorkStatusAction, type WorkStatusSnapshot } from "@/lib/actions/worklogStatus";
import { BREAK_ALERT_MINUTES, formatMinutes, type WorkState } from "@/lib/worklog";

const DOT: Record<WorkState, string> = {
  calismiyor: "bg-zinc-400",
  calisiyor: "bg-emerald-500",
  molada: "bg-amber-500",
  tamamlandi: "bg-sky-500",
};

const actionClass =
  "ui-press inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold disabled:opacity-50";

/**
 * Üst çubuktaki mesai kontrolü.
 *
 * Düğmeler İKON DEĞİL, yazılı: tek bir başlat/durdur düğmesi insana molada
 * olduğunu unutturuyordu. Molada gösterge de amber'a dönüyor ve "Molada"
 * yazıyor — durum tek bakışta okunuyor.
 *
 * Veri Header'dan (layout) DEĞİL, buradan bir Server Action ile çekiliyor:
 * Header her istekte çalıştığı için oraya sorgu eklenmiyor (QuickAddModal ile
 * aynı gerekçe). Sayaç yalnızca GÖSTERİM; gerçek süre sunucuda tutuluyor.
 */
export default function WorkLogHeaderWidget() {
  const [status, setStatus] = useState<WorkStatusSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);
  const [pending, startTransition] = useTransition();
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await loadWorkStatusAction());
      setTicks(0);
    } catch {
      // Oturum düştüyse ya da ağ koptuysa gösterge sessizce gizlenir; üst çubuk
      // bir mesai hatası yüzünden kullanılamaz hâle gelmemeli.
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void refresh();
  }, [refresh]);

  const running = status?.state === "calisiyor" || status?.state === "molada";

  // Dakika sayacı yalnız gösterim için ilerler. Her beşinci dakikada sunucudan
  // tazelenir: mola eşiği uyarısı ve başka sekmede yapılan değişiklik
  // buradan görünsün.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setTicks((value) => {
        const next = value + 1;
        if (next % 5 === 0) void refresh();
        return next;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, [running, refresh]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) { setError(result.error ?? "İşlem tamamlanamadı."); return; }
      await refresh();
    });
  }

  if (!status) return null;

  const onBreak = status.state === "molada";
  const netMinutes = status.netMinutes + (status.state === "calisiyor" ? ticks : 0);
  const breakMinutes = status.breakMinutes + (onBreak ? ticks : 0);
  const breakOver = status.breakLimitExceeded || breakMinutes > BREAK_ALERT_MINUTES;

  return (
    <div className="hidden items-center gap-1 md:flex">
      <Link
        href="/mesai"
        title={running
          ? `Mesai · ${onBreak ? "Molada" : "Çalışıyor"} · net ${formatMinutes(netMinutes)} · mola ${formatMinutes(breakMinutes)}`
          : "Mesai kaydı"}
        className={`ui-press inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold ${
          onBreak
            ? "border-amber-400 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-border-default bg-surface text-secondary hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        <span className={`size-1.5 rounded-full ${DOT[status.state]}`} />
        {onBreak ? (
          <>
            <span>Molada</span>
            <span className="tabular-nums">{formatMinutes(breakMinutes)}</span>
          </>
        ) : running ? (
          <span className="tabular-nums text-foreground">{formatMinutes(netMinutes)}</span>
        ) : (
          <span className="text-muted">Mesai</span>
        )}
        {(status.stale || breakOver) && <span className="text-danger">!</span>}
      </Link>

      {!running ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(startWorkAction)}
          className={`${actionClass} border-emerald-400 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300`}
        >
          Çalışmaya başla
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(onBreak ? endBreakAction : startBreakAction)}
            className={`${actionClass} ${
              onBreak
                ? "border-emerald-400 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                : "border-amber-400 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
            }`}
          >
            {onBreak ? "Molayı bitir" : "Mola ver"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => endWorkAction(new FormData()))}
            className={`${actionClass} border-border-default bg-surface text-secondary hover:bg-surface-hover`}
          >
            Çalışmayı bitir
          </button>
        </>
      )}

      {breakOver && running && (
        <span
          role="status"
          title={`Toplam mola ${BREAK_ALERT_MINUTES} dakikayı aştı.`}
          className="hidden whitespace-nowrap rounded-md bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger lg:inline"
        >
          Mola {BREAK_ALERT_MINUTES} dk&apos;yı aştı
        </span>
      )}
      {error && <span role="alert" className="max-w-40 truncate text-[10px] text-danger">{error}</span>}
    </div>
  );
}
