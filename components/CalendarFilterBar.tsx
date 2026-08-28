"use client";

import { useRef } from "react";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import type { CalendarEventType } from "@/lib/types";

// Takvim filtre çubuğu. Eskiden iki `<select>` + bir "Filtrele" düğmesi üç
// sütunluk bir kartta duruyordu ve ekranın tam genişliğini kaplıyordu; artık
// tek satır: arama + iki kompakt seçici, seçim değişince form kendi gönderiliyor.
//
// GET formu bilerek korundu (`/tasks`teki istemci filtresinden farklı): takvim
// verisi aya göre SUNUCUDA çekiliyor, filtreyi istemciye almak ayın tüm
// etkinliklerini her seferinde taşımak demek olurdu.
export default function CalendarFilterBar({
  month,
  brands,
  types,
  brandId,
  type,
  query,
}: {
  month: string;
  brands: readonly { id: string; name: string }[];
  types: readonly { value: CalendarEventType; label: string }[];
  brandId: string | null;
  type: CalendarEventType | null;
  query: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  return (
    <form ref={formRef} method="get" role="search" className="flex w-full min-w-0 flex-wrap items-center gap-2">
      <input type="hidden" name="month" value={month} />

      <label className="relative w-full min-w-0 basis-full sm:min-w-64 sm:basis-auto sm:flex-1 sm:max-w-sm">
        <span className="sr-only">Etkinlik ara</span>
        <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Etkinlik, marka veya konum ara…"
          className="pl-8 pr-2.5 text-xs"
        />
      </label>

      <Select
        name="brand"
        defaultValue={brandId ?? ""}
        onChange={submit}
        aria-label="Markaya göre filtrele"
        className="text-xs sm:w-40"
      >
        <option value="">Tüm markalar</option>
        {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
      </Select>

      <Select
        name="type"
        defaultValue={type ?? ""}
        onChange={submit}
        aria-label="Türe göre filtrele"
        className="text-xs sm:w-32"
      >
        <option value="">Tüm türler</option>
        {types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </Select>

      {/* Seçiciler kendi gönderiyor; bu düğme yalnızca arama kutusundan
          Enter'a basmayan (ve JavaScript'i kapalı olan) kullanıcı için. */}
      <button
        type="submit"
        className={buttonClass({ variant: "secondary", className: "px-3 text-xs" })}
      >
        Ara
      </button>

      {(brandId || type || query) && (
        <a
          href={`/calendar?month=${month}`}
          className={buttonClass({ variant: "ghost", className: "px-2.5 text-xs font-medium text-muted" })}
        >
          Temizle
        </a>
      )}
    </form>
  );
}
