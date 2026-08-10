// Üst menüdeki bölüm linkleri. Hem masaüstü header'ı (components/NavLinks.tsx)
// hem de mobil off-canvas panel (components/SidebarNavLinks.tsx) buradan okur
// — header dar ekranda linkleri sığdıramadığı için gizleniyor, linkler panele
// taşınıyor. Tek liste, iki yerde: yeni sayfa eklerken burayı güncellemek yeter.
export interface NavItem {
  readonly href: string;
  readonly label: string;
  // Yalnızca "Sosyal" gibi bir grubun alt sayfaları olduğunda dolu. Masaüstünde
  // açılır menüye, mobilde akordeona dönüşür (bkz. NavLinks/SidebarNavLinks).
  readonly children?: readonly NavItem[];
}

export const MAIN_NAV: readonly NavItem[] = [
  { href: "/brands", label: "Markalar" },
  { href: "/tasks", label: "Görevler" },
  { href: "/calendar", label: "Takvim" },
  {
    href: "/social",
    label: "Sosyal",
    children: [
      { href: "/social/takip", label: "Takip" },
      { href: "/social/varlik", label: "Varlık" },
      { href: "/social/takvim", label: "Paylaşım Takvimi" },
    ],
  },
  { href: "/reports", label: "Raporlar" },
  { href: "/activity", label: "Aktivite" },
  { href: "/team", label: "Ekip" },
  { href: "/templates", label: "Şablonlar" },
  { href: "/panom", label: "Panom" },
] as const;

// Raporlar yalnızca yöneticilere açık. Eskiden bu filtre NavLinks VE
// SidebarNavLinks'te birebir kopyalanmıştı — Sosyal'in alt sayfalarıyla bu
// çoğalma büyürdü, tek yerde topluyoruz.
export function visibleNav(canViewReports: boolean): readonly NavItem[] {
  return canViewReports ? MAIN_NAV : MAIN_NAV.filter((item) => item.href !== "/reports");
}

// Bir linkin "aktif" sayılıp sayılmayacağı: tam eşleşme ya da alt rota
// (`/social` → `/social/takvim` aktif sayar). Eski masaüstü kodundaki çıplak
// `pathname.startsWith(href)` "/socialmedia" gibi alakasız bir yolu da
// yanlışlıkla aktif sayardı — mobildeki (doğru) kural artık tek yerde.
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
