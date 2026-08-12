const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

export function normalizeInstagramHandle(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input) return null;

  let candidate = input;
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) {
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
    }
  } catch {
    // Kullanıcı adı biçimindeki değerler URL değildir; aşağıda normalize edilir.
  }

  const handle = candidate.replace(/^@+/, "").replace(/^\/+|\/+$/g, "").trim();
  return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? handle : null;
}

export function instagramProfileUrl(value: string | null | undefined): string | null {
  const handle = normalizeInstagramHandle(value);
  return handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : null;
}
