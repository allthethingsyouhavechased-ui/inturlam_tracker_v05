import type { IconName } from "@/lib/icons";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: IconName;
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "calisma",
    label: "Çalışma",
    items: [
      { href: "/", label: "Bugün", icon: "home" },
      { href: "/panom", label: "Panom", icon: "board" },
      { href: "/tasks", label: "Görevler", icon: "tasks" },
      { href: "/calendar", label: "Takvim", icon: "calendar" },
    ],
  },
  {
    id: "portfoy",
    label: "Portföy",
    items: [
      { href: "/brands", label: "Markalar", icon: "brands" },
      { href: "/social", label: "Sosyal", icon: "social" },
      { href: "/ideas", label: "Fikir Bankası", icon: "ideas" },
    ],
  },
  {
    id: "organizasyon",
    label: "Organizasyon",
    items: [
      { href: "/team", label: "Ekip", icon: "team" },
      { href: "/reports", label: "Raporlar", icon: "reports" },
      { href: "/requests", label: "Talepler", icon: "inbox" },
      { href: "/activity", label: "Aktivite", icon: "activity" },
    ],
  },
] as const;

export function visibleNavGroups(
  canViewReports: boolean,
  canViewRequests: boolean,
): readonly NavGroup[] {
  if (canViewReports && canViewRequests) return NAV_GROUPS;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (canViewReports || item.href !== "/reports")
        && (canViewRequests || item.href !== "/requests"),
    ),
  }));
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface RouteContext {
  readonly section: string;
  readonly label: string;
}

export function routeContextForPathname(pathname: string): RouteContext {
  if (pathname.startsWith("/settings/security")) return { section: "Ayarlar", label: "Güvenlik" };
  if (pathname.startsWith("/settings/profile")) return { section: "Ayarlar", label: "Profil bilgileri" };
  if (pathname.startsWith("/settings")) return { section: "Ayarlar", label: "Hesap" };
  if (pathname.startsWith("/tasks/")) return { section: "Görevler", label: "Görev detayı" };
  if (pathname.startsWith("/templates")) return { section: "Görevler", label: "Görev şablonları" };
  if (pathname.startsWith("/ideas/")) return { section: "Fikir Bankası", label: "Fikir detayı" };
  if (pathname.startsWith("/requests/")) return { section: "Talepler", label: "Talep değerlendirme" };
  if (pathname.startsWith("/brands/") && pathname.includes("/content/")) {
    return { section: "Markalar", label: "İçerik detayı" };
  }
  if (pathname.startsWith("/brands/") && pathname.endsWith("/reports")) {
    return { section: "Markalar", label: "Etkinlik raporları" };
  }
  if (pathname.startsWith("/brands/")) return { section: "Markalar", label: "Marka çalışma alanı" };
  if (pathname.startsWith("/team/manage")) return { section: "Ekip", label: "Hesap yönetimi" };
  if (pathname.startsWith("/team/")) return { section: "Ekip", label: "Kişi profili" };
  if (pathname.startsWith("/reports/")) return { section: "Raporlar", label: "Rapor detayı" };
  if (pathname.startsWith("/search")) return { section: "Arama", label: "Sonuçlar" };
  if (pathname.startsWith("/whoami")) return { section: "Hesap", label: "Kimlik seçimi" };

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isNavActive(pathname, item.href)) return { section: group.label, label: item.label };
    }
  }
  return { section: "INTURLAM", label: "Tracker" };
}
