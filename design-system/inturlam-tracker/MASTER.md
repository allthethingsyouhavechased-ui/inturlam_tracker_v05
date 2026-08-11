# INTURLAM Tracker Design System

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

A warm-neutral editorial operations interface with porcelain and ink surfaces, one disciplined iris accent, Geist typography with restrained weight contrast, a compact 4/8 spacing rhythm, and flat hairline components capped at 12px radius.

## Interaction thesis

Fast, precise CSS-native feedback (100-220ms): color and border changes plus at most 1px translation on hover, direct press feedback, no bounce, parallax, decorative scroll reveal or continuous ambient motion; all motion is disabled through `prefers-reduced-motion`.

## Color

### Light

| Role | Value |
| --- | --- |
| Canvas | `#F5F5F2` |
| Surface | `#FFFFFF` |
| Subtle surface | `#FAFAF8` |
| Muted surface | `#EFEFEB` |
| Foreground | `#1A1A1E` |
| Secondary text | `#55545D` |
| Muted text | `#74737D` |
| Subtle border | `#E9E8E3` |
| Default border | `#DCDAD4` |
| Strong border | `#C8C5BD` |
| Primary | `#5649D8` |
| Primary hover | `#463AB7` |
| Primary subtle | `#F2F1FF` |

### Dark

| Role | Value |
| --- | --- |
| Canvas | `#0C0C0E` |
| Surface | `#141417` |
| Subtle surface | `#18181C` |
| Muted surface | `#202026` |
| Foreground | `#F3F2F7` |
| Secondary text | `#C2C0CA` |
| Muted text | `#96949F` |
| Subtle border | `#232329` |
| Default border | `#303038` |
| Strong border | `#464650` |
| Primary | `#8E86F7` |
| Primary hover | `#AAA2FF` |
| Primary subtle | `#1C1845` |

Semantic colors always pair icon or text with color: success `#177A55`, warning `#A15C00`, danger `#C43652`, information `#2965C7`. Never use red/green alone to communicate state.

## Typography

- Family: Geist Sans. Data and dates may use Geist Mono.
- Display: 32/38, weight 620, tracking -0.035em.
- H1: 26/32, weight 620, tracking -0.025em.
- H2: 18/24, weight 600, tracking -0.015em.
- Body: 14/21, weight 400.
- Body strong: 14/21, weight 560.
- Caption: 12/17, weight 450.
- Eyebrow: 11/16, weight 620, tracking 0.09em; sentence case is preferred over all caps.

## Layout and spacing

- Base unit: 4px. Primary scale: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Desktop sidebar: 252px expanded, 76px collapsed.
- Top bar: 64px.
- Default page width: 1360px. Dense workspaces may use 1600px; reading columns remain 720px or narrower.
- Breakpoints verified at 375, 768, 1024 and 1440px.
- Page headers establish one primary action; secondary operations move into contextual controls.

## Shape and elevation

- Radius: 6px small, 10px control, 12px surface, 16px modal, full only for avatars/status chips.
- Cards are not the default grouping mechanism. Prefer sections, dividers and rows.
- Low elevation is a 1px border. Medium elevation is reserved for popovers. High elevation is reserved for modals.
- No glassmorphism. Backdrop blur is allowed only for the sticky top bar and modal overlay where it communicates layering.

## Components

- Navigation: icon + label, grouped by product responsibility. Active state uses an iris-tinted surface and an inset leading marker.
- Button: primary is filled iris; secondary is a bordered surface; ghost is text on hover surface; destructive is semantic red.
- Input: 40-44px height, persistent label, 10px radius, visible focus ring.
- Surface: 12px radius and hairline border; interactive surfaces receive hover border/surface changes, never large lift.
- Badge: text + semantic tone, 6px radius; pill only for counters.
- Tabs: contextual to a domain, with a compact selected surface; not repeated in global navigation.

## Motion

- Quick: 100ms. Standard: 160ms. Deliberate: 220ms.
- Signature easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Frequent hover: color/border only, 100ms.
- Popover/modal enter: opacity + translateY(4px), 160-220ms ease-out.
- Exit: opacity + translateY(2px), 100-160ms ease-in.
- No animation of width, height, top, left, padding or margin.

## Accessibility and quality gates

- Normal text contrast >= 4.5:1; UI boundaries/focus indicators >= 3:1.
- 44px touch targets on mobile; 28-36px pointer targets are permitted on desktop when spacing is safe.
- Visible `:focus-visible` on every interactive element.
- A skip link precedes the app shell.
- Navigation is reachable by keyboard and active state includes `aria-current`.
- No information is reachable only by hover.
- Reduced motion is mandatory.
