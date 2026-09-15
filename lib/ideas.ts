import type {
  IdeaCategory,
  IdeaSourcePlatform,
  IdeaStatus,
} from "@/lib/types";

export const IDEA_CATEGORIES: IdeaCategory[] = [
  "Icerik",
  "Kampanya",
  "Gorsel",
  "Strateji",
  "Ofis",
  "Diger",
];

export const IDEA_CATEGORY_LABEL: Record<IdeaCategory, string> = {
  Icerik: "İçerik fikri",
  Kampanya: "Kampanya",
  Gorsel: "Görsel dil",
  Strateji: "Strateji",
  Ofis: "Ofis / süreç",
  Diger: "Diğer",
};

export const IDEA_CATEGORY_TONE: Record<IdeaCategory, "brand" | "violet" | "warning" | "success" | "neutral"> = {
  Icerik: "brand",
  Kampanya: "warning",
  Gorsel: "violet",
  Strateji: "success",
  Ofis: "neutral",
  Diger: "neutral",
};

export const IDEA_STATUSES: IdeaStatus[] = ["Yeni", "Gelistiriliyor", "Hazir", "Kullanildi"];

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  Yeni: "Ham fikir",
  Gelistiriliyor: "Geliştiriliyor",
  Hazir: "Hazır",
  Kullanildi: "Kullanıldı",
};

export const IDEA_STATUS_TONE: Record<IdeaStatus, "neutral" | "brand" | "success" | "violet"> = {
  Yeni: "neutral",
  Gelistiriliyor: "brand",
  Hazir: "success",
  Kullanildi: "violet",
};

function supportedWebHost(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function normalizeIdeaSourceUrl(value: string): {
  url: string | null;
  platform: IdeaSourcePlatform | null;
} {
  const raw = value.trim();
  if (!raw) return { url: null, platform: null };
  if (raw.length > 2000) throw new Error("Kaynak bağlantısı en fazla 2000 karakter olabilir.");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Kaynak bağlantısı geçerli bir URL olmalı.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Kaynak bağlantısı http veya https kullanmalı.");
  }

  const hostname = parsed.hostname.toLocaleLowerCase("en-US");
  const platform: IdeaSourcePlatform = supportedWebHost(hostname, "instagram.com")
    ? "Instagram"
    : supportedWebHost(hostname, "tiktok.com")
      ? "TikTok"
      : supportedWebHost(hostname, "pinterest.com") || supportedWebHost(hostname, "pin.it")
        ? "Pinterest"
        : supportedWebHost(hostname, "youtube.com") || supportedWebHost(hostname, "youtu.be")
          ? "YouTube"
          : "Web";
  return { url: parsed.toString(), platform };
}

export function normalizeIdeaTags(value: string): string | null {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(",")) {
    const tag = part.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    if (tag.length > 30) throw new Error("Her etiket en fazla 30 karakter olabilir.");
    const key = tag.toLocaleLowerCase("tr-TR");
    if (!seen.has(key)) {
      tags.push(tag);
      seen.add(key);
    }
  }
  if (tags.length > 8) throw new Error("Bir fikre en fazla 8 etiket eklenebilir.");
  return tags.length > 0 ? tags.join(", ") : null;
}

export function ideaTags(value: string | null): string[] {
  return value ? value.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
}

export function isIdeaCategory(value: unknown): value is IdeaCategory {
  return IDEA_CATEGORIES.includes(value as IdeaCategory);
}

export function isIdeaStatus(value: unknown): value is IdeaStatus {
  return IDEA_STATUSES.includes(value as IdeaStatus);
}

// Fikir silme yetkisi: yönetici tüm fikirleri, sahibi yalnız kendi fikrini
// silebilir. Arayüz ve Server Action AYNI yardımcıyı çağırıyor; sayfada
// `is_manager === 1` satır içi tekrarı yazma (canDeleteTasks ile aynı desen).
export function canDeleteIdea(
  actor: { id: string; is_manager: number } | null | undefined,
  idea: { created_by_id: string | null; linked_task_id?: string | null },
): boolean {
  if (!actor) return false;
  if (idea.linked_task_id) return false;
  return actor.is_manager === 1 || actor.id === idea.created_by_id;
}
