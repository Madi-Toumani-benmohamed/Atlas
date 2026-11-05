# Atlas — Design System

> **Direction:** Midnight Observatory  
> **Status:** Proposed visual specification v1.0  
> **Audience:** Product designers, frontend developers, Codex and other coding agents.

## 1. Product vision

Atlas should feel like a private observatory for ideas: an elegant, quiet, powerful workspace for navigating knowledge, connecting concepts and making progress. The interface should reward daily use through clarity, responsive interaction and thoughtful detail — not visual noise.

**Three adjectives:** contemplative, precise, premium.

**Reference qualities (not clones):** the calm of Linear, the editorial restraint of Raycast, the spatial depth of Arc, and the networked-thinking utility of Obsidian.

**Scope assumption:** this system targets a desktop-first knowledge and productivity application, with notes, linked entities, search, contextual navigation and optional visual explorations. Screen-specific features must be adapted to the actual Atlas product specification; do not fabricate product functionality to match the design.

## 2. Experience principles

1. **Content is the hero.** Information and relationships matter more than visual decoration.
2. **Dark by design, not dark by default.** Use layered charcoal surfaces with excellent text contrast; avoid pure black backgrounds for large content areas.
3. **One luminous accent.** Teal is reserved for active navigation, primary actions, focus and meaningful highlights. Lavender is secondary and specialized, not a competing CTA color.
4. **Composed density.** Spacious at page level; compact in metadata, lists and toolbars. Never force card grids on inherently textual information.
5. **Progressive disclosure.** Show primary actions first; reveal advanced controls through contextual menus and command palette.
6. **Motion has a purpose.** Animate changes of state and spatial continuity, never as decoration.
7. **Beautiful even when empty.** Empty, loading and error states must receive the same attention as populated screens.
8. **Keyboard-first, accessible to all.** Every essential action works without a mouse, with readable focus and reduced-motion support.

## 3. Visual foundation

### 3.1 Color tokens — dark mode (canonical)

| Token | Value | Intended use |
| --- | --- | --- |
| `--bg-canvas` | `#0B0F14` | Outer app canvas |
| `--bg-sidebar` | `#0F141B` | Left rail, persistent navigation |
| `--bg-surface` | `#141B23` | Panels, cards, editor shells |
| `--bg-raised` | `#1B2530` | Hover, nested panels, dropdowns |
| `--bg-overlay` | `#222E3B` | Popovers and floating UI |
| `--text-primary` | `#EDF3F6` | Main headings and content |
| `--text-secondary` | `#A3B1BE` | Descriptions and supporting UI |
| `--text-tertiary` | `#778695` | Quiet metadata, timestamps |
| `--border-subtle` | `#26313D` | Default separators |
| `--border-strong` | `#394958` | Inputs and emphasized boundaries |
| `--accent` | `#67E2CF` | Primary highlights and selected controls |
| `--accent-hover` | `#8DEBDD` | Hover on accent elements |
| `--accent-pressed` | `#46C7B3` | Pressed accent state |
| `--accent-tint` | `rgba(103,226,207,.10)` | Selected backgrounds |
| `--accent-border` | `rgba(103,226,207,.28)` | Selected borders |
| `--accent-ink` | `#09231F` | Text on filled accent buttons |
| `--secondary-accent` | `#B6A4F6` | Knowledge links, graph exploration, insights |
| `--success` | `#6DD6A4` | Successful outcomes |
| `--warning` | `#F1C27D` | Caution |
| `--danger` | `#F28F93` | Destructive states |
| `--focus-ring` | `#9DF5E7` | Visible keyboard focus |

Use semantic colors according to meaning. Do not communicate meaning through color alone. Keep accent-colored body text to links and deliberate emphasis, not paragraphs. Avoid full-screen gradients.

### 3.2 Light mode (required, not a simple inversion)

| Token | Value |
| --- | --- |
| `--bg-canvas` | `#F5F7F8` |
| `--bg-sidebar` | `#EDF1F3` |
| `--bg-surface` | `#FFFFFF` |
| `--bg-raised` | `#E8F0F2` |
| `--bg-overlay` | `#FFFFFF` |
| `--text-primary` | `#15212B` |
| `--text-secondary` | `#4B5C68` |
| `--text-tertiary` | `#637380` |
| `--border-subtle` | `#DCE4E8` |
| `--border-strong` | `#BBC9D0` |
| `--accent` | `#087B70` |
| `--accent-hover` | `#06685F` |
| `--accent-pressed` | `#05564E` |
| `--accent-tint` | `rgba(8,123,112,.08)` |
| `--accent-border` | `rgba(8,123,112,.24)` |
| `--accent-ink` | `#FFFFFF` |
| `--secondary-accent` | `#7053B1` |
| `--success` | `#166B48` |
| `--warning` | `#935B12` |
| `--danger` | `#AE3541` |
| `--focus-ring` | `#087B70` |

Persist the user's theme preference and respect the OS preference when no preference has been set.

### 3.3 Typography

- **UI and body:** `Inter`, fallback `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Editorial headings:** `Manrope`, fallback `Inter, system-ui, sans-serif`.
- **Code and technical identifiers:** `JetBrains Mono`, fallback `ui-monospace, SFMono-Regular, Consolas, monospace`.
- Load only necessary font weights; avoid blocking the app on font downloads.

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Display | `32px / 40px` | 650 | Landing headline, selected hero section |
| H1 | `26px / 34px` | 650 | Page title |
| H2 | `20px / 28px` | 600 | Section title |
| H3 | `16px / 24px` | 600 | Panel / card title |
| Body | `14px / 22px` | 400 | Standard app text |
| Reading | `16px / 27px` | 400 | Long-form content and notes |
| Small | `13px / 19px` | 400 | Secondary UI text |
| Metadata | `12px / 18px` | 450 | Timestamps, labels |
| Button | `13px / 20px` | 600 | Actions |
| Code | `13px / 21px` | 400 | Snippets and inline code |

Use tighter letter spacing (`-0.02em`) on large headings only. Never force all-caps for long labels. Allow long note titles to wrap instead of truncating critical information. Body text contrast must meet WCAG AA (4.5:1); larger text and non-text controls must meet applicable WCAG AA requirements.

### 3.4 Spacing and sizing

- Base grid: **4px**.
- Spacing tokens: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px`.
- Left sidebar width: **252px** expanded, **68px** collapsed.
- Top app bar: **60px** desktop.
- Main page padding: **32px** desktop, **20px** tablet, **16px** mobile.
- Reading column max width: **760px**. Dashboards and exploratory layouts may be wider.
- Tap target: aim for **44×44px** on touch interfaces; compact desktop icon controls may use 36–40px with adequate hit area.
- Standard inputs/buttons: **40px** height.

### 3.5 Radius, borders and elevation

- `6px`: small chips, code backgrounds.
- `10px`: inputs, menus, compact buttons.
- `14px`: default panels and cards.
- `18px`: hero surfaces and large dialogs.
- `9999px`: avatar and status dots only; pill-shaped buttons only when semantically appropriate.
- Default borders: `1px solid var(--border-subtle)`.
- Most surfaces should be flat and differentiated by background/border, not shadows.
- Floating popovers: `0 12px 40px rgba(0,0,0,.28)` in dark mode, `0 12px 36px rgba(22,40,52,.14)` in light mode.
- Avoid glassmorphism on text-heavy regions, thick glowing outlines and excessively blurred panels.

## 4. Brand signature

The Atlas signature is a **subtle navigational motif**: a small constellation / orbital mark created from connected points and arcs. It may appear in the logo, splash screen, empty states and exploration views — not repeatedly behind every card.

- Use **one understated gradient** only for a hero illustration or selected discovery view: `linear-gradient(135deg, rgba(103,226,207,.14), rgba(182,164,246,.07) 60%, transparent)`.
- Use a fine noise texture only if it can be implemented unobtrusively without affecting readability or performance.
- Hero illustrations must not compete with actual content.
- No cliché hacker imagery, skulls, glowing code rain or exaggerated cyber motifs.

## 5. Application shell and navigation

### Desktop layout

1. **Persistent left sidebar** containing Atlas identity, primary navigation, search/command entry and utility destinations.
2. **Top bar** containing current location/breadcrumb, contextual actions and user controls.
3. **Main content area** with a clear page header and focused content region.
4. **Optional right inspector**, width about `320px`, only when relevant to the selected object (properties, backlinks, related knowledge, contextual information). It is dismissible and must never appear as a permanently empty panel.

Sidebar navigation items:
- Default: muted icon and secondary text, transparent background.
- Hover: raised background, no layout shift.
- Active: accent-tinted background, primary text, restrained accent marker; do not use a full bright accent fill.
- Provide icon labels via tooltip when collapsed.
- Persist collapsed/expanded state when technically feasible.

### Responsive behavior

- `>= 1280px`: sidebar and optional inspector visible when needed.
- `768–1279px`: sidebar collapsible, inspector opens as drawer.
- `< 768px`: navigation via accessible drawer or compact mobile navigation; inspector becomes a sheet; main content takes full width.
- No horizontal page scrolling for ordinary content. Large tables and code blocks may scroll inside their own containers.

## 6. Core component rules

### Buttons

- **Primary:** accent fill, dark/light adaptive contrast text, 40px height, 10px radius, 14px horizontal padding. Maximum one dominant primary action per local decision area.
- **Secondary:** surface or raised background with subtle border.
- **Ghost:** transparent until hover, ideal for toolbar actions.
- **Danger:** reserved for destructive confirmation, never the everyday accent.
- Loading state preserves width and disables repeat submission.
- Disabled states are not indicated solely by opacity; remain legible.

### Cards and panels

- Use when grouping heterogeneous information, not as a mandatory wrapper for every row.
- Background `--bg-surface`, 1px subtle border, 14px radius, 16–20px padding.
- Interactive card hover: subtle background/border shift, no scale animation.
- Show a clear title, optional context, and a minimal set of actions.
- Avoid nested card-in-card stacks and repeated prominent badges.

### Lists and knowledge results

- Prefer rows to cards for large note collections.
- One prominent title; a concise excerpt below; metadata aligned consistently.
- Show meaningful context (source, topic, relationship, update time) only when available.
- Active row must be recognizable without relying on color alone.
- Long text uses sensible wrapping or accessible expansion; do not truncate essential identifiers without reveal-on-hover/focus.
- Use empty results messaging with a corrective action.

### Search and command palette

- Search should feel central to the application, not buried inside settings.
- Keyboard shortcut: `Cmd/Ctrl + K` to open a command palette if applicable to implemented functionality.
- Palette width: `min(640px, calc(100vw - 32px))`; centered near upper third of viewport.
- Clear query focus, accessible result categories, keyboard highlight and Enter to select.
- Escape closes; focus returns to trigger; preserve reasonable search state.
- Use clear no-result feedback and optional relevant suggestions; never fabricate results.

### Inputs and forms

- Height 40px by default, 10px radius, raised/surface background, 1px strong border on focus plus visible focus ring.
- Labels remain visible; placeholders supplement labels, never replace them.
- Validation messages appear next to the affected input and are announced accessibly.
- Use monospace only for URLs, code, paths and technical IDs.

### Tags, badges, links

- Tags use small tinted surfaces with muted text; one color per semantic role, not random rainbow accents.
- Status badges are concise and understated.
- Knowledge links use secondary accent with clear hover/focus underline or comparable non-color cue.
- External links indicate their destination behavior.

### Tooltips, popovers and modals

- Tooltips: 12px text, concise, delay ~400ms for mouse hover; show immediately on keyboard focus where appropriate.
- Popovers: 10–14px radius, restrained shadow, use viewport collision handling.
- Confirming destructive actions requires a clear modal with explicit action label.
- Dialogs trap focus and restore it on close; Escape closes non-destructive dialogs.

### Editor / reading surface (if included)

- A quiet canvas with a 760px reading column, 16px/27px body typography and generous paragraph rhythm.
- Structured headings, visible links, readable code blocks, restrained blockquotes.
- Optional outline/metadata should not squeeze the main reading line length.
- Visible, reliable save/sync status when supported. Never claim a save succeeded unless confirmed.

### Graph or relationship explorer (if included)

- Nodes and edges should emphasize **understanding**, not a chaotic light show.
- Use low-contrast edges, clearly selected nodes and readable labels on demand.
- Progressive detail based on zoom; filters and keyboard alternatives are required.
- Motion must be stable; disable unnecessary continuous physics once layout settles.
- Provide a list-based equivalent for core navigation and accessibility.

## 7. Motion and micro-interactions

Motion should convey responsiveness and continuity:

| Interaction | Duration | Easing |
| --- | --- | --- |
| Button / row hover | `120–160ms` | `ease-out` |
| Sidebar collapse / panel reveal | `180–240ms` | `cubic-bezier(.2,.8,.2,1)` |
| Modal / command palette enter | `160–220ms` | `cubic-bezier(.2,.8,.2,1)` |
| Toast entrance / exit | `160–200ms` | `ease-out` |
| Loading skeleton pulse | `1200–1600ms` | gentle, no bright flashes |

- Animate opacity/transform where possible; avoid expensive layout animations on large lists.
- Keep hover transforms minimal or absent on dense UI.
- No permanent floating elements, pulsing neon or autoplay decorative loops.
- Respect `prefers-reduced-motion: reduce` by removing nonessential movement.
- Skeletons resemble final content and do not cause major layout shift.

## 8. States and feedback

Each significant feature must handle **default, hover, focus-visible, active/selected, loading, empty, error, disabled and success** states as applicable.

- **Loading:** lightweight skeleton for structured content, spinner only for small isolated actions.
- **Empty:** meaningful title, one-sentence explanation, one concrete next step. Optional subtle orbital illustration.
- **Error:** describe what failed and provide retry or recovery; preserve user input.
- **Success:** understated toast, short duration with accessible announcement; do not interrupt workflow.
- **Offline/sync:** show accurate state and distinguish pending from confirmed persistence.

## 9. Accessibility and internationalization

- Target **WCAG 2.2 AA**.
- Verify text contrast in both themes; no low-contrast text simply for a softer aesthetic.
- Visible keyboard focus on all interactive controls; logical tab order.
- Semantic landmarks, button names, form labels and accessible dialog patterns.
- Honor browser zoom to 200% and text resizing; handle long French and English strings.
- Do not rely on hover-only access for essential actions.
- Icons must have meaningful accessible names or be decorative.
- Format dates, counts and numbers by locale.
- Avoid using color alone to denote status, selection or importance.

## 10. CSS token implementation

```css
:root {
  color-scheme: dark;
  --bg-canvas: #0B0F14;
  --bg-sidebar: #0F141B;
  --bg-surface: #141B23;
  --bg-raised: #1B2530;
  --bg-overlay: #222E3B;
  --text-primary: #EDF3F6;
  --text-secondary: #A3B1BE;
  --text-tertiary: #778695;
  --border-subtle: #26313D;
  --border-strong: #394958;
  --accent: #67E2CF;
  --accent-hover: #8DEBDD;
  --accent-pressed: #46C7B3;
  --accent-tint: rgba(103, 226, 207, 0.10);
  --accent-border: rgba(103, 226, 207, 0.28);
  --accent-ink: #09231F;
  --secondary-accent: #B6A4F6;
  --success: #6DD6A4;
  --warning: #F1C27D;
  --danger: #F28F93;
  --focus-ring: #9DF5E7;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --sidebar-width: 252px;
  --sidebar-collapsed-width: 68px;
  --topbar-height: 60px;
  --reading-width: 760px;
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg-canvas: #F5F7F8;
  --bg-sidebar: #EDF1F3;
  --bg-surface: #FFFFFF;
  --bg-raised: #E8F0F2;
  --bg-overlay: #FFFFFF;
  --text-primary: #15212B;
  --text-secondary: #4B5C68;
  --text-tertiary: #637380;
  --border-subtle: #DCE4E8;
  --border-strong: #BBC9D0;
  --accent: #087B70;
  --accent-hover: #06685F;
  --accent-pressed: #05564E;
  --accent-tint: rgba(8, 123, 112, 0.08);
  --accent-border: rgba(8, 123, 112, 0.24);
  --accent-ink: #FFFFFF;
  --secondary-accent: #7053B1;
  --success: #166B48;
  --warning: #935B12;
  --danger: #AE3541;
  --focus-ring: #087B70;
}

:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

If using Tailwind or a component library, map these semantic tokens into its theming system. **Do not scatter raw hex colors and arbitrary pixel values across components.**

## 11. Anti-patterns

**Do:**
- Build an instantly recognizable, quiet dark interface.
- Prioritize excellent typography, precise alignment and predictable hierarchy.
- Keep one visual focal point per view.
- Let information density adapt to the task.
- Use premium finishing details: consistent iconography, crisp separators, responsive states.
- Test real content: long note titles, empty collections, technical identifiers, multiple locales.

**Don't:**
- Copy YouTube's red accent, thumbnail-first grids or pill-heavy chrome.
- Turn Atlas into a generic SaaS analytics dashboard.
- Overuse gradients, glass effects, glowing outlines or decorative charts.
- Hide navigation behind mystery-meat icons.
- Use too many cards, too many competing accent colors or 12px body text everywhere.
- Add animations that slow down reading or searching.
- Invent AI actions, metrics, recommendations or knowledge relationships to make screens look populated.

## 12. Representative screens and quality bar

Apply this system coherently to whichever of the following screens exist in Atlas:

1. **Home / overview:** helpful orientation and recent or relevant content; one strong action, not a wall of KPI cards.
2. **Knowledge listing / library:** powerful search, useful filters, scan-friendly rows and obvious metadata.
3. **Knowledge detail / reader:** calm typography, links and relationships, focused contextual inspector.
4. **Explore / graph:** restrained but compelling spatial navigation.
5. **Global command palette:** fast, keyboard-accessible and visually polished.
6. **Settings:** readable preference groups with immediate, honest feedback.

### Acceptance checklist

- [ ] Every screen uses semantic design tokens instead of ad hoc colors.
- [ ] Dark and light themes both work and remain legible.
- [ ] Desktop, tablet and mobile layouts are intentional.
- [ ] Long and empty content does not break layouts.
- [ ] Key controls are accessible with keyboard alone.
- [ ] Focus, loading, error and empty states are implemented.
- [ ] Motion is subtle and honors reduced-motion preference.
- [ ] The UI still looks polished without mock illustrations or demo data.
- [ ] Visual hierarchy supports core Atlas workflows, not decorative dashboard conventions.
- [ ] No product feature is introduced merely because it is mentioned in this visual specification.

## 13. Instructions to implementation agents

Treat this document as the **visual source of truth**, not as a feature requirements document. Prioritize existing Atlas product requirements and existing app architecture for functional scope. Implement the token system and reusable shell/components first, then apply them across existing screens. Prefer small, maintainable, accessible components over one-off page styling. When an unspecified visual decision is needed, choose the simpler, quieter, more readable solution. If using a prebuilt component library, customize it consistently rather than mixing incompatible design languages.

**Desired outcome:** Opening Atlas should feel like entering a personal, meticulously designed workspace — inspiring enough to enjoy, restrained enough to use for hours.
