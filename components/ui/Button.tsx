import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary:
    "border border-border-default bg-surface text-secondary hover:border-border-strong hover:bg-surface-hover hover:text-foreground",
  ghost: "text-secondary hover:bg-surface-hover hover:text-foreground",
  danger: "bg-danger-solid text-white hover:bg-danger-solid-hover",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "min-h-11 gap-1.5 rounded-md px-3 text-xs md:min-h-9",
  md: "min-h-11 gap-2 rounded-md px-4 text-[13px] md:min-h-10",
};

// Herhangi bir öğeye (button, Link, a) aynı görünümü vermek için saf class
// üretici — shadcn'in `buttonVariants` deseni. `Button` bileşeni bunun bir
// `<button>` sarmalayıcısı; `Link`'i buton gibi göstermek gerektiğinde
// doğrudan `className={buttonClass({...})}` kullan.
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "ui-press inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Genel amaçlı buton primitive'i — yalnızca GÖRÜNÜMÜ standartlaştırır.
// Form gönderiminde çift-tık koruması için hâlâ `SubmitButton`
// (useFormStatus) kullanılmalı; o da artık aynı `buttonClass`'ı paylaşıyor.
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
});

export default Button;
