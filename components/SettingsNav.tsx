"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";

const SETTINGS_LINKS = [
  { href: "/settings/profile", label: "Profil bilgileri", description: "Fotoğraf, isim ve ekip bilgisi", icon: "user" as const },
  { href: "/settings/security", label: "Güvenlik", description: "Şifre ve oturum güvenliği", icon: "shield" as const },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Ayar bölümleri" className="space-y-1">
      {SETTINGS_LINKS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`ui-press flex min-h-14 items-start gap-3 rounded-[10px] border px-3 py-2.5 ${
              active
                ? "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-950/60 dark:text-brand-200"
                : "border-transparent text-secondary hover:border-border-subtle hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <Icon name={item.icon} className={`mt-0.5 size-[18px] ${active ? "text-brand-600 dark:text-brand-300" : "text-muted"}`} />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold">{item.label}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
