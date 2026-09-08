"use server";

import { requireSession } from "@/lib/identity";
import { listAllContentSummaries } from "@/lib/repositories/content";
import { listBrandsAlphabetically } from "@/lib/repositories/brands";
import { listActivePeople } from "@/lib/repositories/people";
import type { ContentType, Person } from "@/lib/types";

export interface QuickAddBrandOption {
  id: string;
  name: string;
}

export interface QuickAddContentOption {
  id: string;
  brand_id: string;
  title: string;
  type: ContentType;
}

export interface QuickAddOptions {
  brands: QuickAddBrandOption[];
  contents: QuickAddContentOption[];
  people: Person[];
}

// Hızlı görev penceresinin açılır listeleri. Eskiden bu üç sorgu `Header`de,
// yani LAYOUT'ta duruyordu: pencere kapalıyken bile uygulamanın HER isteğinde
// bütün markalar, bütün içerikler ve bütün kişiler okunuyor ve istemciye
// serileştiriliyordu. Artık yalnızca pencere ilk kez açıldığında bir kez okunuyor.
export async function loadQuickAddOptionsAction(): Promise<QuickAddOptions> {
  await requireSession();
  return {
    brands: listBrandsAlphabetically().map((brand) => ({ id: brand.id, name: brand.name })),
    contents: listAllContentSummaries().map((content) => ({
      id: content.id,
      brand_id: content.brand_id,
      title: content.title,
      type: content.type,
    })),
    people: listActivePeople(),
  };
}
