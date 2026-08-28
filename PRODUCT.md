# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct audiences:
- **İNTURLAM agency team members** (creative/social/design/video/management departments, ~10 named people) — log in with person ID or full name + password, no self-serve signup. They do daily task/content tracking, brand operations, reporting, and team management.
- **Guest/brand accounts** — scoped to exactly one brand each, username + password. See only their own brand dashboard, tasks they opened, explicitly shared calendar events, and explicitly shared deliverable versions for approval. Internal due dates, task owner, weighting, internal notes, and internal comments are never in the guest data contract.

## Product Purpose

A single internal system unifying brand, content, task, team, and event operations for a Turkish creative agency (İNTURLAM) managing ~19 client brands. Replaces informal tracking + a separate Google Sheet that was used for social publishing plans. Hosted on the agency's own infrastructure (currently office LAN at `localhost:3000`/`<office-IP>:3000`; a move to a VPS with a subdomain is planned but not yet done) — this is v03, which took over from v02 on 2026-08-14 with full historical data migrated.

## Positioning

Combines brand/social intelligence (Instagram silence detection via Apify, follower/performance tracking, brand research) with JIRA-style task tracking (kanban boards, priorities, weighted monthly progress 0/25/60/90/100% by status), a client-facing guest approval portal (versioned deliverables V1/V2…, approve or request revision), Google Calendar two-way sync, and an idea bank — in one tool, in Turkish, shaped around this specific agency's actual workflow. A generic Jira/Trello/Asana clone could not truthfully replicate the brand-research layer, the guest delivery/approval contract, or the weighted-progress model.

## Operating Context

Internal ops tool, no public marketing surface. Turkish-language UI throughout. Real named team members and per-brand guest accounts, not open registration. Single SQLite file (`data/inturlam.db`) via Node's built-in `node:sqlite` — no separate DB server, deliberately lightweight. Currently LAN-hosted; production and dev share the same port/DB so they can't run simultaneously. This machine's local clone is fresh (no `data/` yet) and isolated from the office production data — safe to seed for local preview.

## Capabilities and Constraints

- Next.js 16 (App Router, Server Actions, Turbopack) + React 19 + Tailwind CSS v4, TypeScript. `node:sqlite`, no ORM.
- Existing centralized UI primitives in `components/ui/` (`Button`, `Card`, `Badge`, `Input`, `Select`, `Textarea`, `PageHeader`) that most of the 49 pages already consume — new visual work should extend these rather than fork new ad hoc styling per page.
- Drag-and-drop kanban already implemented via `@dnd-kit/core` (`KanbanBoard.tsx`, `TaskBoard.tsx`).
- Accessibility floors already established in the current design system (`design-system/inturlam-tracker/MASTER.md`) and must be preserved regardless of visual direction: text contrast ≥4.5:1, visible `:focus-visible` rings, 44px mobile touch targets, keyboard-reachable nav with `aria-current`, mandatory `prefers-reduced-motion` support.
- This is a visual + motion redesign, not a feature or IA change: existing routes, Server Action behavior, data model, and component ownership must keep working exactly as before.

## Brand Commitments

İNTURLAM agency identity/wordmark (`components/Logo.tsx`) is a real, existing agency brand — not to be reinvented, only re-rendered. Accent color is a centralized `brand-*` Tailwind scale (`app/globals.css` `@theme inline`) by explicit project convention (`CLAUDE.md`: "Aksan rengi `brand-*`, asla `indigo-*` değil") — any new palette must stay swappable through that one token block, never hardcoded per component.

## Evidence on Hand

`npm run db:seed` populates realistic representative data: 19 real brand names/logos, ~10 real team members, brand clusters, sample content items and tasks — safe to use for local design preview on this machine. No fabricated metrics, testimonials, or customer logos should be invented for any redesigned surface; use this real seeded data instead.

## Product Principles

1. This is a small, named, daily-use internal team tool — credibility and trust matter more than marketing flash; boldness should read as "professional software the team is proud to open," not as a landing-page stunt.
2. Task/data scanability and information density must never be sacrificed for animation — this is an Operate-mode surface throughout (dashboards, boards, tables, forms), not a Persuade-mode one.
3. Turkish-language UI and existing copy/terminology are preserved as-is unless the user asks to change specific text.
4. Accessibility floors (contrast, focus-visible, touch targets, reduced-motion, keyboard nav) are non-negotiable and carry forward unchanged even as the visual/motion identity is replaced.

## Accessibility & Inclusion

Existing hard floors from the current design system, to be preserved: normal text contrast ≥4.5:1, UI boundary/focus indicator contrast ≥3:1, visible `:focus-visible` on every interactive element (never animated in), 44px touch targets on mobile, full keyboard reachability with `aria-current` on active nav, and mandatory `prefers-reduced-motion: reduce` support for all new motion.
