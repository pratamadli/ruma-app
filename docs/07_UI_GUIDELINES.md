# RUMA — UI/UX & Design System Direction

## Design Objective

RUMA is a premium modern household operating system.

The interface must feel:

- Premium
- Warm
- Human
- Intelligent
- Calm
- Modern

The user should feel:

> "This is a beautiful, calm place to run our home."

It must not feel like a generic enterprise dashboard, children's app, or overly futuristic AI product.

---

## Brand mark

Canonical assets live in `apps/web/public/brand/` and React components in `@ruma/ui` (`RumaMark`, `RumaBrand`, `RumaLockup`).

| Lockup                   | Use                            |
| ------------------------ | ------------------------------ |
| Mark (+ sage door)       | Marketing, large brand moments |
| Mark mono (no door)      | Favicon / 16–32px              |
| Nav lockup (`RumaBrand`) | App shell, auth headers        |
| Full lockup + tagline    | Landing / OG-style marketing   |

Rules:

- Charcoal ink + sage accent only; uniform stroke; open “A” as roof; flat SVG (no texture).
- When the mark sits beside letters, the mark **is** the leading **R**. Render **UM + open A** only — never “RUM” next to the mark (avoids reading as “RRUMA”).
- Standalone `RumaWordmark` (no mark) may still spell full **RUMA**.
- App navigation uses Next.js `Link` with `RumaBrand`.

## Form controls

`Input`, `Select`, and native `date` / `datetime-local` fields share the same control chrome in `@ruma/ui` (`fieldControlClass`):

- Matching `min-height`, padding, radius (`--ruma-radius-md`), border, soft shadow, and focus ring.
- Prefer `<Select>` over ad-hoc `<select>` styling.
- Date pickers must not use a taller/heavier browser-default chrome than adjacent text/select fields.

---

# UI/UX Pro Max Style Strategy

RUMA should use a **hybrid design strategy**, not one style blindly applied everywhere.

## Primary Foundation — Soft UI Evolution

Use **Soft UI Evolution** as the main visual foundation.

Characteristics:

- soft depth
- subtle elevation
- calm surfaces
- refined rounded components
- tactile but restrained cards
- premium feel
- accessible contrast

Use it across the core product, especially:

- dashboard
- family workspace
- home management
- finance
- assets
- maintenance
- settings

Do not overuse shadows or make every component look neumorphic.

---

## Layout & Typography — Minimalism & Swiss

Use **Minimalism & Swiss** principles for information hierarchy.

Characteristics:

- strong typography
- generous whitespace
- clear grid
- predictable alignment
- restrained decoration
- strong hierarchy
- information density without visual noise

This is especially important for:

- finance
- reports
- tables
- settings
- administration
- complex workflows

The goal is to prevent the Soft UI foundation from becoming a dashboard made entirely of floating cards.

---

## Dashboard Composition — Bento Box Grid

Use **Bento Box Grid selectively**.

Good use cases:

- RUMA dashboard
- household overview
- financial overview
- home health overview
- AI insight summaries

Bento should organize information, not become the entire visual identity.

Avoid turning every page into a collection of disconnected cards.

---

## AI Surfaces — AI-Native UI

Use **AI-Native UI** selectively for RUMA AI features.

Examples:

- RUMA Insights
- monthly AI reports
- financial analysis
- recommendations
- anomaly detection
- household assistant
- predictive reminders

AI interfaces should clearly distinguish:

- verified facts
- calculated results
- AI interpretation
- recommendations

AI must never visually imply that an AI-generated statement is authoritative when the underlying data is uncertain.

---

## Supporting Influence — Organic Biophilic

Use small amounts of **Organic Biophilic** influence where it strengthens the feeling of home.

Possible uses:

- subtle organic shapes
- natural visual motifs
- restrained illustrations
- muted green tones
- warm surfaces

Do not let this turn RUMA into a wellness or lifestyle app.

---

# Recommended Style Ratio

Use this as a design heuristic, not a rigid mathematical rule:

- 50% Soft UI Evolution
- 30% Minimalism & Swiss
- 15% Bento Box Grid
- 5% Organic / AI-Native accents

AI-Native should become more prominent specifically inside RUMA AI surfaces.

---

# Styles to Avoid as Core Identity

Do not use these as the default RUMA visual language:

- Claymorphism
- Neubrutalism
- Gen Z Chaos
- Memphis
- Y2K
- excessive Aurora
- full Glassmorphism
- Liquid Glass as the primary system

Glassmorphism or Liquid Glass may be used sparingly for:

- overlays
- floating AI assistant
- special insight surfaces
- modals
- marketing experiments

---

# Color Direction

## Base

Warm neutral / ivory surfaces.

Example:
`#F8F7F4`

## Primary

Deep charcoal.

Example:
`#191919`

## Accent

Muted sage / emerald.

Example:
`#6F806F`

## Secondary Accent

Warm gold, used sparingly.

Example:
`#C6A66B`

Colors are examples, not immutable tokens. Final tokens belong in the implementation design system.

---

# Typography

Typography is a major part of RUMA's premium identity.

Principles:

- strong hierarchy
- readable body text
- generous line height
- restrained font weights
- large confident headings
- avoid excessive all-caps
- avoid decorative typography

Typography must remain accessible and readable across desktop and mobile.

---

# Layout

Prefer:

- generous whitespace
- consistent spacing scale
- strong alignment
- clear content hierarchy
- responsive grids
- progressive disclosure

Avoid:

- dense dashboards
- unnecessary sidebars
- excessive cards
- visual clutter
- decorative elements without functional value

---

# Cards

Cards are useful but must have hierarchy.

Do not:

- put every piece of information in a card
- use heavy shadows
- nest cards indefinitely

Prefer:

- subtle surface contrast
- restrained elevation
- clear grouping
- meaningful whitespace

---

# Motion

Motion should feel intentional and premium.

Use:

- subtle transitions
- short micro-interactions
- state feedback
- gentle page transitions where useful

Avoid:

- excessive animation
- bouncing UI
- distracting entrance animations
- animation that delays interaction

---

# RUMA UI Prompt

Use this as the canonical UI/UX Pro Max prompt:

> Design a premium modern household operating system for RUMA. Use Soft UI Evolution as the visual foundation with Minimalism & Swiss principles for layout, typography, spacing, and hierarchy. Use Bento Grid selectively for dashboard composition. Create a warm, calm, human, sophisticated interface with generous whitespace, warm neutral surfaces, charcoal typography, muted sage/emerald accents, subtle depth, refined rounded cards, elegant data visualization, and restrained micro-interactions. Use AI-Native UI patterns selectively for RUMA AI surfaces. Add subtle organic influences where appropriate to reinforce the feeling of home. Avoid playful/cartoonish aesthetics, excessive gradients, excessive shadows, noisy dashboards, and generic corporate-finance styling. The product should feel premium like Apple, Notion, and Linear, but warmer and more human.

---

# Design Decision

This design direction supersedes the previous "playful educational platform" prompt.

The previous prompt must not be used as the primary RUMA design direction.
