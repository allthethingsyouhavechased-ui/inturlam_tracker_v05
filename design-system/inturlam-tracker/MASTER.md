# INTracker Design System

This document is the visual source of truth for the local redesign. UI code must use the tokens in `app/globals.css`; page-specific styling may change composition, never the core palette or interaction language.

## Product model

- `Bugun`: agency-level operational attention, not a second navigation page.
- `Panom`: the signed-in person's work and planning.
- `Gorevler`: the complete task inventory and its views.
- `Markalar`: portfolio discovery and brand administration. The brand tree does not live in global navigation.
- `Sosyal`: one domain with contextual tabs for tracking, presence and publishing calendar.
- `Ekip`: people and current allocation.
- `Raporlar`: manager-only analysis.
- `Profil`: a person's public professional identity only.
- `Ayarlar > Profil`: editable identity data.
- `Ayarlar > Guvenlik`: password and session-sensitive actions.

## Visual thesis

A light-mode warm-neutral editorial operations interface paired with a neutral near-black dark workspace, one disciplined muted teal product accent, persistent brand-color spines, Space Grotesk display type, Archivo body type, a compact 4/8 spacing rhythm, and flat hairline components capped at 10px radius.

## Interaction thesis

Fast, precise CSS-native feedback (100-220ms): color and border changes plus at most 1px translation on hover, direct press feedback, no parallax, decorative scroll reveal or continuous ambient motion.

One deliberate exception: **drag**. It is the only interaction that carries the user's own momentum, so it is the only place allowed a spring curve, a scale/rotate transform and a real elevation shadow. Everything else stays on the duration scale below. Motion is *reduced*, not removed, under `prefers-reduced-motion`: transforms are dropped, colour and opacity transitions stay (see Accessibility).

## Color

### Light

| Role | Value |
| --- | --- |
| Canvas | `#F1EFEA` |
| Surface | `#FFFFFF` |
| Subtle surface | `#F8F7F3` |
| Muted surface | `#E6E3DC` |
| Foreground | `#171614` |
| Secondary text | `#4A4741` |
| Muted text | `#63605A` |
| Subtle border | `#E4E1D9` |
| Default border | `#D4D0C6` |
| Strong border | `#B6B1A5` |
| Primary | `#326B61` |
| Primary hover | `#28564F` |
| Primary subtle | `#EEF7F4` |

### Dark

| Role | Value |
| --- | --- |
| Canvas | `#09090A` |
| Surface | `#111113` |
| Subtle surface | `#151517` |
| Muted surface | `#1C1C1F` |
| Foreground | `#F4F3F1` |
| Secondary text | `#CBC9C5` |
| Muted text | `#999791` |
| Subtle border | `#202024` |
| Default border | `#2C2C31` |
| Strong border | `#46464D` |
| Primary | `#84BDAF` |
| Primary hover | `#B4D9CF` |
| Primary subtle | `#0D211E` |

The full muted teal scale is `#EEF7F4`, `#D8ECE6`, `#B4D9CF`, `#84BDAF`, `#5A9F90`, `#438478`, `#326B61`, `#28564F`, `#224640`, `#1D3A35`, `#0D211E`. Semantic colors always pair icon or text with color: success `#17724F` / `#41C08F`, warning `#8A5D0A` / `#E3A73C`, danger `#B33A21` / `#FF9074`, information `#1E5FB8` / `#79A9F0` (light/dark). Never use color alone to communicate state.

## Typography

This scale is not documentation — it ships as tokens in `app/globals.css` (`@theme inline`), so `text-display` / `text-h1` / `text-h2` / `text-body` / `text-caption` / `text-eyebrow` carry their own size, leading, tracking and weight. Do not hand-write `text-[11px] tracking-[-0.025em]` in a new screen.

- Family: Archivo for body, tables and controls; Space Grotesk for display, headings and brand names.
- Display: 32/34, weight 600, tracking -0.030em.
- H1: 24/28, weight 600, tracking -0.020em.
- H2: 17/22, weight 600, tracking -0.010em.
- Body: 14/21, weight 400.
- Caption: 12/16, weight 450.
- Eyebrow: 11/16, weight 650, tracking 0.10em; sentence case is preferred over all caps.
- Tracking is size-specific by design: it goes negative as text grows and slightly positive as it shrinks. A single fixed `letter-spacing` is wrong at one end of the scale or the other.

## Layout and spacing

- Base unit: 4px. Primary scale: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Desktop sidebar: 252px expanded, 76px collapsed.
- Top bar: 64px.
- Default page width: 1360px. Dense workspaces may use 1600px; reading columns remain 720px or narrower.
- Breakpoints verified at 390, 768, 1024 and 1440px.
- Page headers establish one primary action; secondary operations move into contextual controls.

## Shape and elevation

- Radius: 6px badge, 8px control, 10px surface and 16px modal; full only for avatars and counters. A brand spine makes the leading corners square. Nested containers derive the inner radius from the outer one minus its padding (`--card-radius` / `--card-pad` on `components/ui/Card.tsx`) so corners read as concentric.
- Cards are not the default grouping mechanism. Prefer sections, dividers and rows.
- Low elevation is a 1px border. Medium elevation is reserved for popovers. High elevation is reserved for modals. Interactive surfaces (`.ui-surface`) carry **no** resting shadow — only the drag state uses `--shadow-lift`, and that token is redefined for dark mode because a black shadow is invisible on a `#0C0C0E` ground.
- No glassmorphism. Backdrop blur is allowed only for the sticky top bar and modal overlay where it communicates layering.

## Components

- Navigation: icon + label, grouped by product responsibility. Active state uses a muted teal surface and an inset leading marker.
- Button: primary is filled muted teal; secondary is a bordered surface; ghost is text on hover surface; destructive is semantic brick red.
- Input: 40-44px height, persistent label, 8px radius, visible focus ring.
- Surface: 10px radius and hairline border; interactive surfaces receive hover border/surface changes, never large lift.
- Brand-owned rows, cards and calendar entries carry a persistent 3px color spine that widens to 4px on pointer hover. Hues are stored in `brands.accent_hue`; light uses `oklch(0.62 0.13 h)` and dark uses `oklch(0.70 0.14 h)`. Existing persisted brand hues are preserved across the product-accent change.
- Badge: text + semantic tone, 6px radius; pill only for counters.
- Tabs: contextual to a domain, with a compact selected surface; not repeated in global navigation.

## Motion

- Quick: 100ms. Standard: 160ms. Deliberate: 220ms. Spring: 360ms `cubic-bezier(0.16, 1, 0.3, 1)` — **drag only**.
- Signature easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Frequent hover: color/border plus at most 1px lift, 160ms. Hover is seen hundreds of times a day; anything slower or larger costs scanning speed.
- Press: `translateY(1px) scale(0.98)`, 100ms — feedback lands on press, not on release.
- Drag: `scale(0.97) rotate(-0.4deg)` + `--shadow-lift`, spring curve.
- Popover/modal enter: opacity + translateY(4px), 160-220ms ease-out.
- Exit: opacity + translateY(2px), 100-160ms ease-in.
- One-shot list entrance: `.ui-stagger` with `--i` (35ms steps). One authored moment per screen, never repeated per section.
- Keyboard-initiated actions do not animate at all.
- No animation of width, height, top, left, padding or margin.

## Accessibility and quality gates

- Normal text contrast >= 4.5:1; UI boundaries/focus indicators >= 3:1.
- 44px touch targets on mobile; 28-36px pointer targets are permitted on desktop when spacing is safe.
- Visible `:focus-visible` on every interactive element.
- A skip link precedes the app shell.
- Navigation is reachable by keyboard and active state includes `aria-current`.
- No information is reachable only by hover.
- Reduced motion is mandatory — and means *reduced*: drop transforms, keep colour/opacity transitions so state changes stay legible.
- `prefers-reduced-transparency` turns the translucent top bar solid; `prefers-contrast: more` raises hairline borders to the strong tone.
- Drag and drop is keyboard-operable and announces itself in Turkish (`announcements` on every `DndContext`).
