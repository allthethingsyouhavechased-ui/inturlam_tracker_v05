"use client";

import { useEffect, useState } from "react";

// Uzun detay sayfalarında bölüm bölüm aşağı kaydırmak yerine tek tıkla atlama.
// Sayfa başlığının altındaki yapışkan şeritte yerleşir; hangi bölümde olduğunu da gösterir.
//
// Kaydırma yumuşaklığı `globals.css`teki `html { scroll-behavior: smooth }`ten
// geliyor ve `prefers-reduced-motion`da otomatik kapanıyor — burada ayrıca
// `scrollIntoView({ behavior: "smooth" })` çağırmıyoruz, o tercihi es geçerdi.

export interface JumpSection {
  readonly id: string;
  readonly label: string;
}

export default function SectionJumpNav({ sections }: { sections: readonly JumpSection[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    // Yapışkan üst çubuğun altında kalan bölüm "aktif" sayılmasın diye üstten
    // pay bırakıyoruz; alttan büyük negatif pay, aynı anda birden çok bölümün
    // eşleşip son bölümün hep kazanmasını engelliyor.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-104px 0px -65% 0px", threshold: 0 },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Sayfa bölümleri" className="flex min-w-max flex-nowrap items-center gap-1">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={activeId === section.id ? "true" : undefined}
          className={`ui-press inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors ${
            activeId === section.id
              ? "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/55 dark:text-brand-200"
              : "border-border-default bg-surface text-secondary hover:border-border-strong hover:text-foreground"
          }`}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
