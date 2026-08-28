// Geri alınabilir yıkıcı işlem kuyruğu.
//
// Neden onay penceresi değil: `confirm("… geri alınamaz")` aşırı kullanıldığında
// insanlar okumadan tıklamayı öğreniyor, yani hiçbir şeyi korumuyor. Geri
// alınabilir bir silme hem daha hızlı hem gerçekten güvenli.
//
// Neden veritabanında `deleted_at` değil: onlarca görev sorgusunun her birine
// "silinmişleri hariç tut" koşulu eklemek gerekirdi ve UNUTULAN tek bir sorgu
// silinmiş işi rapora sızdırırdı — sessizce. Bunun yerine işlem, geri alma
// süresi dolana kadar HİÇ ÇALIŞTIRILMIYOR (Gmail'in "geri al" deseni).
// Kabul edilen bedel: kullanıcı bu birkaç saniye içinde sekmeyi kapatırsa silme
// hiç gerçekleşmez. Bir silme işleminde "olmadı" güvenli taraftır.

export interface UndoableRequest {
  /** Çubukta görünen metin, ör. "3 görev silindi". */
  readonly message: string;
  /** Geri alma süresi. */
  readonly delayMs?: number;
  /** Süre dolunca çalışacak GERÇEK işlem. */
  readonly commit: () => void;
  /** Geri al'a basılırsa iyimser arayüz değişikliğini geri sarar. */
  readonly rollback: () => void;
}

export interface PendingUndo {
  readonly id: string;
  readonly message: string;
  readonly startedAt: number;
  readonly expiresAt: number;
  /** Geri al: işlem hiç çalışmaz, iyimser değişiklik geri sarılır. */
  readonly undo: () => void;
}

interface PendingEntry extends PendingUndo {
  /** Süreyi beklemeden şimdi işle (yeni bir istek geldiğinde). */
  readonly flush: () => void;
}

export const UNDO_DELAY_MS = 6000;

let pending: PendingEntry | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingUndo(): PendingUndo | null {
  return pending;
}

/** SSR anlık görüntüsü: sunucuda hiçbir zaman bekleyen işlem yoktur. */
export function getServerUndoSnapshot(): PendingUndo | null {
  return null;
}

/**
 * İşlemi geri alma penceresi boyunca beklet. Aynı anda yalnızca BİR bekleyen
 * işlem olur: ikinci bir istek gelirse birincisi hemen işlenir — kullanıcı yeni
 * bir silme yaptıysa öncekini fiilen onaylamış demektir ve iki çubuğu üst üste
 * göstermek hangisinin geri alınacağını belirsizleştirirdi.
 */
export function runUndoable(request: UndoableRequest): void {
  pending?.flush();

  const delayMs = request.delayMs ?? UNDO_DELAY_MS;
  const startedAt = Date.now();
  let settled = false;

  const finish = (action: () => void) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    pending = null;
    action();
    emit();
  };

  const timer = setTimeout(() => finish(request.commit), delayMs);

  pending = {
    id: crypto.randomUUID(),
    message: request.message,
    startedAt,
    expiresAt: startedAt + delayMs,
    undo: () => finish(request.rollback),
    flush: () => finish(request.commit),
  };
  emit();
}
