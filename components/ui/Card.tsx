import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from "react";
import { cn } from "@/lib/cn";

type CardProps<T extends ElementType> = {
  as?: T;
  /** İç boşluğu ver/verme — bir liste/tablo saracak kartlarda `false`. */
  padded?: boolean;
  /** Hover'da hafif kalkma + geçiş (ui-surface, globals.css). Tıklanabilir kartlarda aç. */
  interactive?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "padded">;

// Uygulamanın ortak 10px yüzeyi — eskiden 100+ yerde elle tekrarlanan
// `border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900`
// deseninin tek karşılığı. `bg-surface`/`border-border-default` token'ları
// (globals.css) temaya göre kendi değerini değiştirdiği için burada ayrıca
// `dark:` class'ı YOK — bu, token katmanının asıl kazancı.
export default function Card<T extends ElementType = "div">({
  as,
  padded = true,
  interactive = false,
  className,
  ...props
}: CardProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      // `--card-radius`/`--card-pad` çocuklara MİRAS kalır: iç içe bir kontrol
      // `rounded-[calc(var(--card-radius)-var(--card-pad))]` yazarak eşmerkezli
      // köşe alır. Sabit bir iç yarıçap (ör. `rounded-lg`) dış yarıçap ya da
      // padding değiştiğinde gözle kaymaya başlıyor.
      style={{ "--card-radius": "0.625rem", "--card-pad": padded ? "0.25rem" : "0rem" } as CSSProperties}
      className={cn(
        "rounded-[var(--card-radius)] border border-border-default bg-surface",
        interactive && "ui-surface cursor-pointer",
        padded && "p-4 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
