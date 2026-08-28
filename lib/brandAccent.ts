import type { CSSProperties } from "react";

const ACCENT_MIN = 15;
const ACCENT_MAX_EXCLUSIVE = 330;
const INITIAL_SLOT_COUNT = 19;

export function normalizeBrandAccentHue(value: number): number {
  if (!Number.isFinite(value)) return 210;
  return Math.min(ACCENT_MAX_EXCLUSIVE - 1, Math.max(ACCENT_MIN, Math.round(value)));
}

export function brandAccentHueForIndex(index: number): number {
  const safeIndex = Math.max(0, Math.floor(index));
  const position = safeIndex % INITIAL_SLOT_COUNT;
  return Math.round(
    ACCENT_MIN + ((ACCENT_MAX_EXCLUSIVE - ACCENT_MIN) * position) / INITIAL_SLOT_COUNT,
  );
}

function hueDistance(left: number, right: number): number {
  const direct = Math.abs(left - right);
  return Math.min(direct, 360 - direct);
}

// İlk 19 marka okunaklı ve dengeli sabit yuvaları kullanır. Portföy büyürse
// en uzak boş tonu seçer; isim değişikliği rengi değiştirmez çünkü sonuç DB'ye
// yalnız oluşturma anında yazılır.
export function chooseBrandAccentHue(usedHues: readonly number[]): number {
  const used = usedHues.map(normalizeBrandAccentHue);
  for (let index = 0; index < INITIAL_SLOT_COUNT; index += 1) {
    const candidate = brandAccentHueForIndex(index);
    if (!used.includes(candidate)) return candidate;
  }
  let best = ACCENT_MIN;
  let bestDistance = -1;
  for (let candidate = ACCENT_MIN; candidate < ACCENT_MAX_EXCLUSIVE; candidate += 1) {
    const distance = Math.min(...used.map((hue) => hueDistance(candidate, hue)));
    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function brandAccentStyle(hue: number | null | undefined): CSSProperties {
  return {
    "--brand-accent-hue": String(normalizeBrandAccentHue(hue ?? 210)),
  } as CSSProperties;
}
