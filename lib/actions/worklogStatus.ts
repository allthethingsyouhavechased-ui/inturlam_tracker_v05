"use server";

import { requireSession } from "@/lib/identity";
import { getOpenWorkSession, workStateFor } from "@/lib/repositories/worklog";
import type { WorkState } from "@/lib/worklog";

export interface WorkStatusSnapshot {
  state: WorkState;
  /** Sunucunun hesapladığı NET dakika; tarayıcı sayacı bunun üstüne sayar. */
  netMinutes: number;
  breakMinutes: number;
  startedAt: string | null;
  stale: boolean;
  /** Günün TOPLAM molası eşiği aştı mı (tek tek molalar değil). */
  breakLimitExceeded: boolean;
}

/**
 * Üst çubuktaki mesai göstergesinin verisi.
 *
 * Neden Header'da doğrudan okunmuyor: Header LAYOUT'ta, yani uygulamanın HER
 * isteğinde çalışıyor. Hızlı görev penceresinin listeleri de aynı gerekçeyle
 * oradan alınıp `loadQuickAddOptionsAction`a taşınmıştı — bu gösterge de kendi
 * verisini istemciden çekiyor.
 */
export async function loadWorkStatusAction(): Promise<WorkStatusSnapshot> {
  const actor = await requireSession();
  const open = getOpenWorkSession(actor.id);
  return {
    state: workStateFor(open),
    netMinutes: open?.net_minutes ?? 0,
    breakMinutes: open?.break_minutes ?? 0,
    startedAt: open?.started_at ?? null,
    stale: open?.stale ?? false,
    breakLimitExceeded: open?.break_limit_exceeded ?? false,
  };
}
