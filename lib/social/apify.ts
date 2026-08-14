import type { FetchOptions, FetchResult, FetchedPost, SocialProvider } from "@/lib/social/types";
import { safeHttpUrl } from "@/lib/urlSafety";

// Apify'ın `apify/instagram-post-scraper` aktörü: bir istekte birden çok
// kullanıcı adı alır, her biri için son gönderileri döndürür.
//
// Neden run-sync DEĞİL: Apify'ın "çalıştır ve sonucu bekle" uçları 5 dakikada
// zaman aşımına uğruyor; 19 hesaplık bir tarama bunu aşabiliyor. Bu yüzden
// çalıştırma asenkron başlatılıp durum sorgulanıyor (aşağıdaki poll döngüsü).
//
// Neden `onlyPostsNewerThan` GÖNDERİLMİYOR: tarih filtresi verilirse uzun
// süredir sessiz olan hesap sıfır sonuç döndürür ve "en son ne zaman paylaştı"
// bilgisi hiç öğrenilemez. Bunun yerine hesap başına birkaç gönderi çekilip
// en yenisinin tarihi alınıyor — sessizlik süresi böylece gerçekten ölçülüyor.

const API_ROOT = "https://api.apify.com/v2";
const DEFAULT_ACTOR = "apify~instagram-post-scraper";
const POLL_INTERVAL_MS = 5000;

interface ApifyRunResponse {
  data?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
  };
}

// Aktörün döndürdüğü alanların yalnızca kullandıklarımız. Sağlayıcı yeni alan
// eklerse kırılmasın diye gevşek tutuluyor.
interface ApifyPostItem {
  id?: string;
  shortCode?: string;
  url?: string;
  type?: string;
  caption?: string;
  timestamp?: string;
  ownerUsername?: string;
  inputUrl?: string;
  // Aktör, erişilemeyen bir hesap için gönderi yerine hata kaydı yazar.
  error?: string;
  errorDescription?: string;
  username?: string;
  // Ortak gönderi (collab): gönderi birden çok hesabın profilinde birden
  // görünür ama Apify yalnızca birincil sahibi ownerUsername'e yazar — ortak
  // yazarlar burada listelenir.
  coauthorProducers?: { username?: string }[];
}

function requireToken(): string {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "APIFY_TOKEN tanımlı değil. Apify hesabındaki API token'ını .env.local dosyasına ekle (APIFY_TOKEN=...).",
    );
  }
  return token;
}

async function apiFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Apify ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`,
    );
  }
  return response.json();
}

// "https://www.instagram.com/kahvecihb/" → "kahvecihb"
function handleFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = /instagram\.com\/([^/?#]+)/i.exec(url);
  return match ? match[1].toLowerCase() : null;
}

function toIso(timestamp: string | undefined): string | null {
  if (!timestamp) return null;
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Bir gönderinin ait sayılacağı TÜM takip edilen hesapları çözer. Normalde tek
// hesap (ownerUsername) yeterli, ama ORTAK GÖNDERİ'de (collab) gönderi iki
// hesabın da profilinde görünür; yalnızca ownerUsername'e bakarsak ortak yazar
// olan taraf hep "hiç paylaşım yapmamış" gibi görünür (gerçek bug — bir hesap
// başka bir markayla ortak gönderi paylaştığında sessiz sanılıyordu). Burada
// owner + tüm coauthorProducers birlikte döndürülür; sync.ts zaten bizim
// TAKİP ETMEDİĞİMİZ handle'ları otomatik eleyeceği için (brandByHandle.get)
// burada ekstra bir filtreye gerek yok.
export function resolveHandlesForItem(item: ApifyPostItem): string[] {
  const handles = new Set<string>();
  const owner =
    item.ownerUsername?.toLowerCase() ??
    item.username?.toLowerCase() ??
    handleFromUrl(item.inputUrl);
  if (owner) handles.add(owner);
  for (const coauthor of item.coauthorProducers ?? []) {
    const handle = coauthor.username?.toLowerCase();
    if (handle) handles.add(handle);
  }
  return [...handles];
}

export function createApifyProvider(): SocialProvider {
  const actor = process.env.APIFY_INSTAGRAM_ACTOR?.trim() || DEFAULT_ACTOR;

  return {
    name: `apify:${actor}`,

    async fetchRecentPosts(handles: string[], options: FetchOptions): Promise<FetchResult> {
      const token = requireToken();
      if (handles.length === 0) return { posts: [], errorsByHandle: {} };

      const deadline = Date.now() + options.timeoutMs;
      const remaining = () => Math.max(1000, deadline - Date.now());

      const started = (await apiFetch(
        `${API_ROOT}/acts/${actor}/runs?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: handles,
            resultsLimit: options.perAccount,
            skipPinnedPosts: true,
            dataDetailLevel: "basicData",
          }),
        },
        Math.min(30_000, remaining()),
      )) as ApifyRunResponse;

      const runId = started.data?.id;
      if (!runId) throw new Error("Apify çalıştırması başlatılamadı (run id dönmedi).");

      let datasetId = started.data?.defaultDatasetId ?? null;
      let status = started.data?.status ?? "RUNNING";

      while (status === "RUNNING" || status === "READY") {
        if (Date.now() >= deadline) {
          throw new Error(
            `Apify çalıştırması ${Math.round(options.timeoutMs / 1000)} sn içinde bitmedi (run ${runId}).`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const polled = (await apiFetch(
          `${API_ROOT}/actor-runs/${runId}?token=${encodeURIComponent(token)}`,
          { method: "GET" },
          Math.min(30_000, remaining()),
        )) as ApifyRunResponse;
        status = polled.data?.status ?? status;
        datasetId = polled.data?.defaultDatasetId ?? datasetId;
      }

      if (status !== "SUCCEEDED") {
        throw new Error(`Apify çalıştırması ${status} durumunda bitti (run ${runId}).`);
      }
      if (!datasetId) throw new Error("Apify çalıştırması veri kümesi kimliği döndürmedi.");

      const items = (await apiFetch(
        `${API_ROOT}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true&format=json`,
        { method: "GET" },
        Math.min(60_000, remaining()),
      )) as ApifyPostItem[];

      const posts: FetchedPost[] = [];
      const errorsByHandle: Record<string, string> = {};

      for (const item of Array.isArray(items) ? items : []) {
        if (item.error) {
          const handle =
            item.ownerUsername?.toLowerCase() ??
            item.username?.toLowerCase() ??
            handleFromUrl(item.inputUrl) ??
            null;
          if (handle) {
            errorsByHandle[handle] = item.errorDescription?.trim() || item.error;
          }
          continue;
        }

        const postedAt = toIso(item.timestamp);
        const externalId = item.id ?? item.shortCode ?? null;
        if (!postedAt || !externalId) continue;

        // Sağlayıcının `url` alanı DOĞRULANMADAN saklanamaz: bu değer Takip
        // tablosunda `href` olarak çiziliyor, `javascript:` şemalı bir kayıt
        // tıklanabilir bir XSS'e dönerdi. Şema düşerse kendi kurduğumuz
        // shortCode adresine, o da yoksa `null`'a düşülür.
        const permalink =
          safeHttpUrl(item.url) ??
          (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null);
        const mediaType = item.type ?? null;
        const caption = item.caption?.slice(0, 500) ?? null;

        for (const handle of resolveHandlesForItem(item)) {
          posts.push({ externalId, handle, postedAt, permalink, mediaType, caption });
        }
      }

      return { posts, errorsByHandle };
    },
  };
}
