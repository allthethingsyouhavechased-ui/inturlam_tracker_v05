import { brandAccentStyle } from "@/lib/brandAccent";

const SIZE_CLASS = {
  sm: "h-7 w-7 text-xs",
  lg: "h-16 w-16 text-xl",
} as const;

export default function BrandLogo({
  name,
  logoPath,
  accentHue,
  size = "sm",
}: {
  name: string;
  logoPath: string | null;
  accentHue?: number | null;
  size?: "sm" | "lg";
}) {
  const sizeClass = SIZE_CLASS[size];
  if (logoPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoPath}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-border-default`}
      />
    );
  }
  return (
    <div
      data-brand-accent
      style={brandAccentStyle(accentHue)}
      className={`${sizeClass} brand-logo-fallback flex shrink-0 items-center justify-center rounded-full font-display font-semibold`}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
