# Status colors get a text role and a fill role; floating surfaces use ui-raised

Status: accepted

Date: 2026-11-13

## Context

We reviewed the frontend design system against the design records Meta
published with [Astryx](https://github.com/meta/astryx) (`docs/design/`:
color emphasis, system states, user states, elevation hierarchy, and
`docs/architecture/theme-tokens.md`). Most of those records are drafts, so we
used them as a checklist of topics, not as rules. Our DESIGN.md is already
stricter on measured contrast and color-vision checks. The review found these
gaps.

**One status token did two jobs.** `--color-status-error` was both text
(`text-status-error`, needs 4.5:1) and fill (`bg-status-error` dots, gauges,
bars, needs 3:1). Light values were darkened for text, so the warn dot and
gauges rendered brown (`#925500`). Dark values were lightened for text, so no
status color could carry white text, and the `danger` button used the
primitive `bg-red-600`. One meaning, "error", appeared in four reds: status
`#c4282d`, log level `red-600` and `red-700`, and danger `red-600`. Astryx
separates status roles by surface (INV11: text, strong fill with on-color,
muted fill).

Measuring the fills with the same deuteranopia simulation (Machado 2009, ΔE)
that DESIGN.md §1.4 uses for healthy vs error also showed that **healthy and
idle were nearly the same color**: ΔE 8.9 in light and 4.5 in dark. Idle used
the same value as `text-muted`.

**Floating surfaces had no rule.** Tooltip and the card menu used `ui-raised`,
while the `Select` listbox and chart tooltips used `bg-surface`. In dark mode
`shadow-lg` is nearly invisible and card vs page contrast is 1.07, so a
listbox opened inside a card had the card's color and only a 1.54:1 border.

**Basic states were missing.** There were no `active:` classes in the whole
app. Tailwind v4 puts `hover:` inside `@media (hover: hover)`, so tapping a
button on a touch screen showed no change at all. Disabled opacity was 40, 50
or 60 depending on the component. `color-scheme` was never declared, so native
checkboxes and scrollbars stayed light in dark mode. In forced-colors mode the
browser drops background colors, so status dots vanished. Inputs were 14px on
phones, which makes iOS Safari zoom on focus. The focus ring used `primary`,
which is 3.38 to 3.62 on dark backgrounds and 2.51 on `ui-raised`.

## Decision

1. **Status colors have a text role and a fill role.** `status-{tone}` stays
   the text role with its current values. New `status-{tone}-fill` tokens are
   for dots, gauges, bars, check strips, threshold lines and validation
   borders, with 3:1 against white, `bg-main` and `ui-hover`:

   | tone | light fill | dark fill |
   |---|---|---|
   | healthy | `#059669` | `#3dd6c6` (same as text) |
   | warn | `#c77700` | `#ffca16` (same as text) |
   | error | `#dc2626` | `#ff6369` (same as text) |
   | idle | `#80838d` | `#80838d` |

   Deuteranopia ΔE: healthy/error 41.2 light, 42.8 dark; healthy/idle 17.1 and
   21.0; warn/error 13.3 and 49.2. A teal light healthy (`#0d9488`) would give
   58.4 against error but only 1.5 against idle, so we chose emerald.

   Alpha tints (`bg-status-*/10`) keep using the text token because DESIGN.md
   §5.1b measured badge contrast on those tints.

2. **`danger` is its own token**, `#dc2626` with hover `#b91c1c` in both
   themes, like `primary`. White text is 4.83 and 6.47.

3. **Log levels error and warn use the status tokens.** Info, debug and trace
   keep their own colors because status has no equivalent.

4. **Floating surfaces without a scrim use `ui-raised`** (tooltips, chart
   tooltips, `Select` listbox, card menus, toasts). Surfaces above a scrim
   (modals, side panels, command palette) keep `bg-surface`, because the scrim
   already separates them. No new token: `ui-raised` already existed for this
   role.

5. **Basic states**: pressed is one step darker than hover (`-hover` fills,
   `ui-active`, `/15` tints); disabled is `opacity-50`; the focus ring uses
   `action`; `color-scheme` follows the theme; `bg-status-*-fill` elements keep
   their color in forced-colors mode; inputs are 16px below `sm`.

## Consequences

- `pnpm lint` rejects a solid `bg-status-{tone}` without `-fill`. The
  forced-colors rule matches the `-fill` class name, so the name is load
  bearing.
- `chartTheme` exposes `errorColor` and `warnColor` as fills and renames
  `tooltipBg` to `surfaceColor`, which is what it was used for. Chart tooltips
  are styled with classes.
- Light-mode status dots and gauges are brighter. Dark mode fills do not
  change except idle, which is darker so it no longer looks like healthy.
- Toasts, z-index layers and the rule that links inside sentences are
  underlined are now written in DESIGN.md §7 and §8. The existing sentence
  links already used `underline`; the rule records that practice.
