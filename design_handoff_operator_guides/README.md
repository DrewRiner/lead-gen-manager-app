> # ⚠️ RETIRED — this design system is no longer used
>
> The warm-paper + Instrument-Serif "operator guide" treatment described below has
> been **retired**. The /guides section now uses the main app's Tailwind + shadcn/ui
> styling (same tokens as Dashboard/Leads), for one consistent product look.
>
> - **Content is unchanged** — same guides, steps, callouts, checklists.
> - Only the layout/styling changed; guide navigation moved from the horizontal
>   pill row to the app's left sidebar.
> - Do **not** use the `.og-*` classes, `operator-guide.css`, warm-paper palette,
>   serif display type, or mono eyebrows described here for anything new.
>
> This file is kept only as a historical record of the original handoff.

---

# Handoff: Operator guides (Guides page) — Blue Carrot Solutions Command Center

## Overview
Nine internal step-by-step runbooks for the ops team, to live under the dashboard's **Guides** section (one page per guide, plus an index). Each guide walks an operator through a property/client/integration task with the exact warnings and verification steps baked in.

Guides, in the order they should appear:

1. Onboarding a client onto a rented property
2. Switch a property to a new client
3. Update a client's phone number or email
4. Connect a contact form (Engine Evolve)
5. Connect CallRail call tracking
6. Connect Twilio call tracking
7. Change how or where a client gets notified
8. Set up a new lead gen property to collect leads
9. A client says they're not getting leads — what to check

## About the Design Files
The files in `designs/` are **design references created in HTML** — prototypes showing the intended look, structure, and behavior. They are **not production code to copy directly**.

The task is to **recreate these designs inside the Command Center codebase** using its existing environment and patterns (React/Next.js components, its routing, its styling approach). Copy the visual system and the content verbatim; implement it the codebase's way.

Each file is a self-contained HTML page that opens directly in a browser (they use a small runtime, `designs/support.js`, purely so the prototypes render — do not port that runtime). Inside each file, the markup between `<x-dc>` and `</x-dc>` is the page body; the `class Component` script only powers the "Done" checkboxes.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and copy. Recreate pixel-faithfully, but swap in the codebase's existing primitives (Card, Table, Badge, Button) where they can carry the same values.

One important note: the guides contain **mockups of your own UI** (dashboard tables, Engine Evolve screens, CallRail settings, form builder). Those are illustrations *inside* the guide — static, non-interactive figures. Do not wire them to live data. They can be recreated as static markup or replaced with real screenshots later.

## Content is authoritative
All guide prose — "Why this matters", "Before you start", every numbered step, every ⚠️ WARNING, and "How to check it worked" — is **final approved copy**. Reproduce it verbatim, including the URLs:

- `https://app.enginevolve.com`
- `https://lead-gen-manager-app.vercel.app/api/webhooks/ghl-form`
- `https://lead-gen-manager-app.vercel.app/api/webhooks/callrail?secret=YOUR_SECRET`
- `https://lead-gen-manager-app.vercel.app/api/webhooks/twilio`

Sample names/numbers inside the mockups (Sumter Roofing Company, Marios Bros Fencing, Jamie Floyd, (912) 555-0177, (803) 373-1022, dollar amounts, dates) are **placeholder illustration data**, not real records.

## Screens / Views

### A. Guide page (the only real screen — nine instances)
**Purpose:** an operator follows one task end to end, ticking off steps.

**Layout** — single column, `max-width: 1120px`, centered, page padding `0 32px 96px`, page background `#F6F3ED`.

Vertical order:

1. **Guide nav strip** — `display:flex; gap:7px; flex-wrap:wrap; padding:28px 0 0`. Nine pills linking the sibling guides; the current guide is a non-link pill. Pill: `font-family: IBM Plex Mono; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; border-radius:999px; padding:6px 11px`. Inactive: `color:#4A4741; background:#EAE6DC; border:1px solid #DCD7CA` (hover `color:#171614; background:#E2DDD1`). Active: `color:#fff; background:#17161A; border:1px solid #17161A`.
2. **Header** — `padding:40px 0 44px; display:grid; grid-template-columns:1fr auto; gap:40px; align-items:end; border-bottom:2px solid #171614`.
   - Eyebrow: IBM Plex Mono 12px/500, `letter-spacing:.18em`, uppercase, `#8C877D`, `margin-bottom:18px`. Text pattern `Internal runbook / <Section>`. (The troubleshooting guide's eyebrow is `#C63F1E`.)
   - H1: Instrument Serif 400, `62px` (first guide `66px`), `line-height:1.03`, `letter-spacing:-.015em`, `max-width:20ch`, `text-wrap:pretty`.
   - Sub: 19px/1.5, `#4A4741`, `max-width:54ch`.
   - Right column: step-count / trap-count pills + `"{n} of {N} steps checked off"` counter (IBM Plex Mono 12px, `#8C877D`).
3. **Why this matters** — `padding:52px 0; border-bottom:1px solid #DEDAD0`. Two columns `minmax(0,1fr) minmax(0,1.05fr)`, `gap:56px`, `align-items:start`. Left: H2 Instrument Serif 34px + body 18px/1.6 `#2A2823`. Right: a diagram card (varies per guide — failure/success pair, match/mismatch pair, or a flow).
4. **Before you start** — same two-column split, `border-bottom:2px solid #171614`. Right side is a white checklist card: header row (`#FBFAF7`, IBM Plex Mono 11px/600 `letter-spacing:.14em` uppercase `#8C877D`, "Pre-flight"), then rows `padding:16px 20px`, `gap:14px`, each with an empty checkbox square `18×18, border:1.5px solid #C9C4B8, border-radius:4px` + 16px label. Some guides add a footer row of system chips (Dashboard = `#17161A` swatch, Engine Evolve = `#BAF25A` swatch).
5. **"Steps" label** — IBM Plex Mono 12px/600, `letter-spacing:.2em`, uppercase, `#8C877D`, `padding:44px 0 8px`.
6. **Step blocks** (one per step) — `display:grid; grid-template-columns:132px minmax(0,1fr); gap:32px; padding:36px 0; border-top:1px solid #DEDAD0`. The last step block also gets `border-bottom:2px solid #171614`.
   - **Left rail** (flex column, `gap:16px`, `align-items:flex-start`): numeral in Instrument Serif `72px`, `line-height:.78`; a system badge; a "Done" toggle button.
   - **System badge**: IBM Plex Mono 10px/600, `letter-spacing:.14em`, uppercase, `border-radius:5px`, `padding:6px 9px`, `white-space:nowrap`.
     - Dashboard / neutral: `color:#4A4741; background:#EAE6DC; border:1px solid #DCD7CA`
     - Engine Evolve: `color:#2A3D0A; background:#BAF25A; border:1px solid #A5DC46`
     - Twilio: `color:#fff; background:#E31E26`
     - Critical step ("Exact match", "Both boxes", "Double-check"): `color:#fff; background:#C63F1E`
   - **Done button**: white, `border:1.5px solid #C9C4B8`, `border-radius:8px`, `padding:8px 10px`, IBM Plex Mono 11px uppercase `#4A4741`, hover border/text `#171614`; contains a `14×14` box that shows a green `✓` (`#2F6B4F`) when checked.
   - **Right column**: H3 Instrument Serif 400 `30px`/1.15, then body 18px/1.6 `#2A2823` `max-width:62ch`, then the visual(s).
7. **How to check it worked** — `padding:56px 0 0`, two columns `minmax(0,1fr) minmax(0,1.15fr)`, `gap:56px`. Left: H2 + body. Right: a verification stack, always ending in a dark closing card: `background:#17161A; border-radius:12px; padding:18px 20px`, a `24px` `#BAF25A` circle with `✓` in `#2A3D0A`, and an Instrument Serif 22px line in `#FBFAF7`.

### B. Guides index (not designed — needs building)
A list of the nine guides. Reuse the nav-strip pill styling, or a simple card list with the guide title (Instrument Serif) + one-line description (`#4A4741`). Match the existing Guides section's list patterns if one already exists.

## Recurring components (build these once, reuse across all nine)

| Component | Spec |
|---|---|
| **Section shell** | Two-column grid `minmax(0,1fr) minmax(0,1.05fr)`, `gap:56px`, `padding:52px 0`, hairline `1px solid #DEDAD0` or rule `2px solid #171614` |
| **Step block** | `132px` rail + content, `gap:32px`, `padding:36px 0`, `border-top:1px solid #DEDAD0` |
| **White panel** | `background:#fff; border:1px solid #E3DFD5; border-radius:12px; overflow:hidden; box-shadow:0 1px 2px rgba(23,22,20,.04), 0 14px 32px -24px rgba(23,22,20,.35)`. Deep variant for large mockups: `0 1px 2px rgba(23,22,20,.04), 0 18px 40px -26px rgba(23,22,20,.4)` |
| **Panel header** | `padding:11px 16px; background:#FBFAF7; border-bottom:1px solid #EDEAE2`, IBM Plex Mono 10px `letter-spacing:.12em` uppercase `#A9A398` |
| **Field label** | IBM Plex Mono 9.5–10px, `letter-spacing:.12em`, uppercase, `#A9A398`, `margin-bottom:5–6px` |
| **Field box (normal)** | `border:1px solid #E3DFD5; border-radius:6–8px; padding:9–11px 11–13px; font-size:12.5–14px` |
| **Field box (the value that matters)** | `border:1.5px solid #C63F1E; background:#FDF7F4;` same padding, IBM Plex Mono value. Optional blinking caret: `1.5px × 14px` bar `#171614`, `animation: omBlink 1.1s step-end infinite` |
| **WARNING block** | `border:1px solid #F0C6B7; background:#FBEAE4; border-radius:11px; padding:14px 16px; display:flex; gap:12px; align-items:flex-start`. Tag: IBM Plex Mono 10px/600 `letter-spacing:.12em` `color:#fff; background:#C63F1E; border-radius:5px; padding:4px 7px; flex:none`, text "WARNING". Body 14.5px/1.5 `#5C3226` |
| **Success block** | `border:1px solid #C7DBCF; background:#EDF5F0; border-radius:12px`; text `#245740`; check circle `#2F6B4F` bg, white glyph |
| **Status pill** | IBM Plex Mono 9.5–10px, `letter-spacing:.06–.08em`, uppercase, `border-radius:999px`, `padding:3–4px 7–9px`. Live/Published/Billable: `color:#245740; background:#EDF5F0; border:1px solid #D3E4DA`. Unassigned/error: `color:#93290F; background:#FBEAE4; border:1px solid #F0C6B7`. Draft: `color:#8C6A17; background:#FBF2DA; border:1px solid #EBDBA8`. Neutral: `color:#8C877D; background:#F4F1EA; border:1px solid #E3DFD5` |
| **Mock table** | CSS grid with fractional columns; header row `padding:9–12px 16–18px; background:#FBFAF7; border-bottom:1px solid #EDEAE2`, IBM Plex Mono 9.5px `letter-spacing:.1–.12em` uppercase `#A9A398`. Body rows `padding:11–14px 16–18px`, `font-size:11.5–13.5px`, separated by `1px solid #F3F0E9` |
| **Highlighted mock row** | `background:#FDF4F0; border:1.5px solid #C63F1E; border-radius:8–9px; animation: omRing 2.4s ease-out infinite` |
| **Workflow node** | `max-width:300–330px`, white, `border:1px solid #D9D4C8`, `border-radius:10px`, `padding:11–13px`; header row with a `20×20` `border-radius:5px` icon tile + 12.5px/600 label. Nodes joined by a `1px × 18–22px` `#CFC9BC` connector. Node needing edits: `border:1.5px solid #C63F1E` + `box-shadow:0 8px 20px -14px rgba(198,63,30,.6)` and a `#FDF7F4` value strip |
| **Breadcrumb chips** | flex `gap:8px`, IBM Plex Mono 11px; chip `background:#EAE6DC; border-radius:6px; padding:6px 9px`; separator `→` in `#A9A398`; final/current chip `background:#17161A; color:#fff` |
| **Publish toggle** | track `30×17px, border-radius:999px`; off `#DCD7CA` with knob left, on `#BAF25A` with knob right; knob `12×12` white, inset `2.5px` |
| **Code/URL block** | `background:#17161A; border-radius:10px; padding:13px 15px`, IBM Plex Mono 12.5px `#EDEAE2`, `overflow:auto`. Optional method tag: IBM Plex Mono 9.5px `color:#BAF25A; border:1px solid #4A6B14; border-radius:5px; padding:4px 7px` |

## Interactions & Behavior
- **Done checkboxes** — one per step. Toggling flips the `✓` and updates the header counter. Persisted in `localStorage` under a per-guide key (prototype keys: `onboarding-guide-steps-v1`, `switch-client-guide-steps-v1`, `update-contact-guide-steps-v1`, `connect-form-guide-v1`, `callrail-guide-v1`, `twilio-guide-v1`, `notify-method-guide-v1`, `new-property-guide-v1`, `no-leads-guide-v1`). In production, store per user (and ideally per property/client the operator is working on) rather than per browser.
- **Nav pills** — plain navigation between guides. Current guide renders as a non-interactive pill.
- **Cross-guide links** — the troubleshooting guide links inline to *Set up a new lead gen property* and *Update a client's phone number or email*. Keep those as real links.
- **Link styling** — `a { color:#C63F1E; border-bottom:1px solid rgba(198,63,30,.35) }`, hover `#93290F`.
- **Two ambient animations** (decorative, respect `prefers-reduced-motion`):
  - `omRing` — 2.4s ease-out infinite pulse on the element the operator should click: `box-shadow` from `0 0 0 0 rgba(198,63,30,.38)` to `0 0 0 16px rgba(198,63,30,0)`.
  - `omBlink` — 1.1s step-end infinite caret blink (opacity 1 → 0 at 50%).
- **Hover states** — only the nav pills and Done buttons have them. Everything inside a mockup is static.
- No loading, error, or form-validation states. Responsive behavior was not designed — below ~900px, collapse every two-column grid to one column and let the mock tables scroll horizontally.

## State Management
Minimal. Per guide: `done: { [stepNumber]: boolean }`, hydrated on mount from storage, written on every toggle; derived `doneCount`. Two prototype-level flags exist and can be dropped or kept as props: `showAnnotations` (boolean, shows the explanatory callouts inside mockups) and `interactiveChecklist` (boolean, shows the Done buttons + counter). The first guide also has `mockupDetail: "full" | "simplified"`, which trims a few optional rows.

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| Paper | `#F6F3ED` | page background |
| Panel | `#FFFFFF` | cards, mockups |
| Panel subtle | `#FBFAF7` | panel headers, footers |
| Surface warm | `#F4F1EA` / `#F7F5F1` | mock sidebars, workflow canvas |
| Ink | `#171614` | headings, rules, dark cards |
| Ink alt | `#17161A` | dark chips/cards |
| Body | `#2A2823` | body copy |
| Muted | `#4A4741` | secondary copy |
| Muted 2 | `#6B665E` | tertiary copy |
| Faint | `#8C877D` | eyebrows, meta |
| Faint 2 | `#A9A398` | field labels |
| Placeholder | `#B0A9A0` | struck-through / empty values |
| Border | `#E3DFD5` | panel borders |
| Border hairline | `#EDEAE2` / `#F1EEE7` / `#F3F0E9` | internal dividers |
| Border warm | `#DCD7CA` / `#D9D4C8` / `#C9C4B8` | chips, inputs, checkboxes |
| Rule | `#DEDAD0` | section hairlines |
| Accent (vermilion) | `#C63F1E` | the value that matters, warnings, active nav marker |
| Accent dark | `#93290F` | warning headings/meta |
| Accent deep text | `#5C3226` | warning body |
| Accent wash | `#FBEAE4` / `#FDF7F4` / `#FDF4F0` | warning + highlight fills |
| Accent border | `#F0C6B7` / `#EDD5CB` / `#EBC4B4` / `#F3E4DD` | warning borders |
| Success | `#2F6B4F` | check circles |
| Success text | `#245740` / `#4A6B5C` | success copy |
| Success wash | `#EDF5F0` / `#E3EFE8` / `#F4FAF6` | success fills |
| Success border | `#C7DBCF` / `#D3E4DA` / `#D8E7DE` | success borders |
| Engine Evolve | `#BAF25A` | brand accent (badges, toggles, sidebar marker) |
| Engine Evolve dark text | `#2A3D0A` / `#4A6B14` | text on the lime |
| Engine Evolve border/wash | `#A5DC46` / `#EDFAD6` / `#C7E39A` | lime supporting tones |
| Twilio | `#E31E26` | Twilio badge |
| Dashboard blue | `#2E5A8F` + `#EEF3FB` / `#D7E3F3` | integration accents in mockups |
| Dashboard green dot | `#22A06B` | connected indicator |
| Draft amber | `#8C6A17` / `#FBF2DA` / `#EBDBA8` | draft status |
| Dashboard nav active | `#111827` | Command Center sidebar active item |

### Typography
- **Display / headings** — Instrument Serif 400. H1 `62px` (`66px` on guide 1) / `line-height:1.03` / `letter-spacing:-.015em`; H2 `34px`/1.1; H3 `30px`/1.15; closing line `22px`; mock page titles `24–26px`; step numerals `72px`/`.78`.
- **UI / body** — IBM Plex Sans 400/500/600. Body `18px`/1.6; lead `19px`/1.5; mock UI `11–15px`; captions `10.5–12.5px`.
- **Mono** — IBM Plex Mono 400/500/600. Eyebrow `12px`; labels `9.5–11px`; values `10.5–14px`.
- Google Fonts: `Instrument+Serif:ital@0;1`, `IBM+Plex+Sans:wght@400;500;600`, `IBM+Plex+Mono:wght@400;500;600`.

### Spacing / radius / shadow
- Page: `max-width:1120px`, padding `0 32px 96px`.
- Section padding `52px 0`; step padding `36px 0`; column gap `56px` (content) / `32px` (step rail) / `14–20px` (card stacks).
- Radii: `999px` pills · `12px` panels · `11px` warnings · `9px` inner cards · `6–8px` inputs/buttons · `5px` badges/icon tiles · `4px` checkboxes.
- Shadows: `0 1px 2px rgba(23,22,20,.04), 0 14px 32px -24px rgba(23,22,20,.35)` (card) · `0 1px 2px rgba(23,22,20,.04), 0 18px 40px -26px rgba(23,22,20,.4)` (large mockup) · `0 8px 20px -14px rgba(198,63,30,.6)` (accent node).
- Body reset: `margin:0; padding:0; box-sizing:border-box` on everything.

## Assets
None — no images, no icon library. Every glyph in the prototypes is a Unicode character (`✓ ✕ → ↑ ⧉ ◉ ≈ ▣ 🔔 💬 ⚡ ⚯ ▾ 📁`) and every "screenshot" is hand-built markup. **When implementing, swap these for the codebase's real icon set** (the emoji-style glyphs in workflow nodes especially).

## Files
In `designs/` — each opens directly in a browser:

| File | Guide |
|---|---|
| `Client Onboarding Guide.dc.html` | Onboarding a client onto a rented property |
| `Switch Property To New Client.dc.html` | Switch a property to a new client |
| `Update Client Contact Info.dc.html` | Update a client's phone number or email |
| `Connect A Contact Form.dc.html` | Connect a contact form (Engine Evolve) |
| `Connect CallRail Call Tracking.dc.html` | Connect CallRail call tracking |
| `Connect Twilio Call Tracking.dc.html` | Connect Twilio call tracking |
| `Change Notification Method.dc.html` | Change how or where a client gets notified |
| `Set Up New Lead Gen Property.dc.html` | Set up a new lead gen property to collect leads |
| `Client Not Getting Leads.dc.html` | A client says they're not getting leads |
| `support.js` | prototype runtime only — **do not port** |

## Known gaps for the implementer
- Guides 1–3 contain an **Assign client** modal and a generic dashboard sidebar that were drawn before the real UI was available. The live Command Center uses **Reassign / Change rate / Unassign** actions and a `Dashboard · Properties · Clients · Leads · Reports · Guides · Settings` sidebar with active item `#111827`. Prefer the real UI when recreating those figures.
- No Guides index page was designed (see "Guide page B" above).
- No mobile breakpoints were designed.
