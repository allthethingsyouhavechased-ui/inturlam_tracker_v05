"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Icon from "@/components/ui/Icon";
import {
  endBreakAction,
  endWorkAction,
  startBreakAction,
  startWorkAction,
} from "@/lib/actions/worklog";
import { loadWorkStatusAction, type WorkStatusSnapshot } from "@/lib/actions/worklogStatus";
import { WORK_STATE_LABEL, formatMinutes, type WorkState } from "@/lib/worklog";

const DOT: Record<WorkState, string> = {
  calismiyor: "bg-zinc-400",
  calisiyor: "bg-emerald-500",
  molada: "bg-amber-500",
  tamamlandi: "bg-sky-500",
};

/**
 * Üst çubuktaki mesai göstergesi: durum noktası, sayaç ve tek dokunuşluk
 * eylem. Ayrıntılı geçmiş ve düzeltme istekleri /mesai sayfasında kalıyor.
 *
 * Veri Header'dan (layout) DEĞİL, buradan bir Server Action ile çekiliyor —
 * Header her istekte çalıştığı için oraya sorgu eklenmiyor (QuickAddModal ile
 * aynı gerekçe). Sayaç yalnızca GÖSTERİM: gerçek süre sunucuda tutuluyor.
 */
export default function WorkLogHeaderWidget() {
  const [status, setStatus] = useState<WorkStatusSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);
  const [pending, startTransition] = useTransition();
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await loadWorkStatusAction();
      setStatus(next);
      setTicks(0);
    } catch {
      // Oturum düşmüş ya da ağ koptuysa gösterge sessizce gizlenir; üst çubuk
      // bir mesai hatası yüzünden kullanılamaz hâle gelmemeli.
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void refresh();
  }, [refresh]);

  // Sayaç yalnız çalışırken ilerler: molada net süre artmıyor.
  useEffect(() => {
    if (status?.state !== "calisiyor") return;
    const timer = setInterval(() => setTicks((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, [status?.state]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) { setError(result.error ?? "İşlem tamamlanamadı."); return; }
      await refresh();
    });
  }

  if (!status) return null;

  const minutes = status.netMinutes + (status.state === "calisiyor" ? ticks : 0);
  const running = status.state === "calisiyor" || status.state === "molada";

  return (
    <div className="hidden items-center gap-1 md:flex">
      <Link
        href="/mesai"
        title={`Mesai · ${WORK_STATE_LABEL[status.state]}${running ? ` · net ${formatMinutes(minutes)}` : ""}`}
        className="ui-press inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-default bg-surface px-2.5 text-[11px] font-semibold text-secondary hover:bg-surface-hover hover:text-foreground"
      >
        <span className={`size-1.5 rounded-full ${DOT[status.state]}`} />
        {running ? (
          <span className="tabular-nums text-foreground">{formatMinutes(minutes)}</span>
        ) : (
          <span className="text-muted">Mesai</span>
        )}
        {status.stale && <span className="text-warning">!</span>}
      </Link>

      {!running ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(startWorkAction)}
          aria-label="Mesaiyi başlat"
          title="Mesaiyi başlat"
          className="ui-press touch-target inline-flex size-9 items-center justify-center rounded-md border border-border-default bg-surface text-emerald-600 hover:bg-surface-hover disabled:opacity-50 dark:text-emerald-400"
        >
          <Icon name="clock" className="size-4" />
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(status.state === "molada" ? endBreakAction : startBreakAction)}
            aria-label={status.state === "molada" ? "Molayı bitir" : "Mola ver"}
            title={status.state === "molada" ? "Molayı bitir" : "Mola ver"}
            className="ui-press touch-target inline-flex size-9 items-center justify-center rounded-md border border-border-default bg-surface text-amber-600 hover:bg-surface-hover disabled:opacity-50 dark:text-amber-400"
          >
            {status.state === "molada" ? "▶" : "❙❙"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => endWorkAction(new FormData()))}
            aria-label="Günü bitir"
            title="Günü bitir"
            className="ui-press touch-target inline-flex size-9 items-center justify-center rounded-md border border-border-default bg-surface text-secondary hover:bg-surface-hover disabled:opacity-50"
          >
            <Icon name="check" className="size-4" />
          </button>
        </>
      )}
      {error && <span role="alert" className="max-w-40 truncate text-[10px] text-danger">{error}</span>}
    </div>
  );
}
