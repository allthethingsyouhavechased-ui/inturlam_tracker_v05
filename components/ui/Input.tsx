import { forwardRef } from "react";
import { cn } from "@/lib/cn";

// 17 dosyada neredeyse birebir tekrarlanan input/select class'ının tek
// karşılığı — `Select`/`Textarea` de bunu paylaşır. `bg-surface`/
// `border-border-default` temaya göre kendi değerini değiştirir, bu yüzden
// burada `dark:` yok.
export const controlClass = (className?: string) =>
  cn(
    "min-h-11 w-full rounded-md border border-border-default bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted hover:border-border-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-10",
    className,
  );

const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={controlClass(className)} {...props} />;
  },
);

export default Input;
