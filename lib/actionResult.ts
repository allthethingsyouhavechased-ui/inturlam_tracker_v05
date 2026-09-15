// Server Action'ların hata sözleşmesi.
//
// SORUN: Bir Server Action `throw new Error("Görev başlığı zorunlu.")` yaptığında
// Next.js bunu ÜRETİMDE maskeliyor — istemciye yalnızca bir digest ve React'in
// genel "Server Components render" hatası (React #441, https://react.dev/errors/441)
// ulaşıyor. Yani yazdığımız Türkçe doğrulama mesajı kullanıcıya hiç gitmiyor,
// yerine anlamsız bir hata kodu görünüyor ve form "kaydedilemedi" gibi duruyor
// (oysa doğrulama hatasında kaydedilmemesi doğru, ama sebebi söylenmeli).
//
// ÇÖZÜM: Beklenen hatalar FIRLATILMAZ, dönüş değeri olarak taşınır — dönüş değeri
// serileştirilip istemciye olduğu gibi ulaşır, maskelenmez. Beklenmeyen hatalar
// maskelenmeye devam eder ama sunucuda izlenebilir bir kimlikle kaydedilir ve
// kullanıcı o kimliği görür, böylece kayıt ile ekran eşleştirilebilir.

/** Kullanıcıya AYNEN gösterilecek, beklenen (doğrulama/yetki/iş kuralı) hatası. */
export class ExpectedActionError extends Error {
  readonly code: ActionErrorCode;
  constructor(message: string, code: ActionErrorCode = "validation") {
    super(message);
    this.name = "ExpectedActionError";
    this.code = code;
  }
}

export type ActionErrorCode = "validation" | "conflict" | "forbidden" | "notFound";

export interface ActionFailure {
  ok: false;
  error: string;
  code: ActionErrorCode | "unexpected";
  /** Yalnızca beklenmeyen hatada dolu; sunucu kaydındaki karşılığı. */
  traceId?: string;
  /** Eşzamanlı düzenlemede sunucudaki güncel değerler (form "yeniden uygula" sunar). */
  current?: Record<string, string | null>;
}

export interface ActionSuccess<T = undefined> {
  ok: true;
  value?: T;
  message?: string;
}

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function actionError(message: string, code: ActionErrorCode = "validation"): ActionFailure {
  return { ok: false, error: message, code };
}

// Next.js'in kendi kontrol akışı hataları (`redirect()`, `notFound()`) Error
// olarak fırlatılır ama YAKALANMAMALIDIR — yutulursa yönlendirme hiç olmaz.
function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}

/** Sunucu kaydıyla eşleştirilebilen kısa kimlik — kullanıcı ekranda bunu görür. */
function newTraceId(): string {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

export function toActionFailure(error: unknown, context: string): ActionFailure {
  if (isNextControlFlowError(error)) throw error;
  if (error instanceof ExpectedActionError) {
    return { ok: false, error: error.message, code: error.code };
  }
  const traceId = newTraceId();
  console.error(`[action:${context}] beklenmeyen hata (izleme ${traceId})`, error);
  return {
    ok: false,
    code: "unexpected",
    traceId,
    error: `İşlem tamamlanamadı. Sorun kaydedildi (izleme kodu ${traceId}). Verilerin formda duruyor, tekrar deneyebilirsin.`,
  };
}

/**
 * Bir Server Action gövdesini hata sözleşmesine sarar. Beklenen hatalar mesajıyla,
 * beklenmeyenler izleme kimliğiyle DÖNER; hiçbiri fırlatılmaz — böylece istemci
 * maskelenmiş bir digest yerine gerçek sebebi alır.
 */
export async function runAction<T = undefined>(
  context: string,
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    return toActionFailure(error, context);
  }
}

/**
 * Yazma BAŞARILI olduktan SONRA çalışan yan etkiler (bildirim, etkinlik kaydı,
 * dış duyuru) için. Bunlardan biri patlarsa kullanıcıya "kaydedilemedi" denmemeli:
 * kayıt veritabanında duruyor. Hata yutulmaz, sunucuya izlenebilir kimlikle yazılır.
 */
export async function runAfterCommit(context: string, body: () => Promise<void> | void): Promise<void> {
  try {
    await body();
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    console.error(`[after-commit:${context}] yan etki başarısız (kayıt korundu)`, error);
  }
}
