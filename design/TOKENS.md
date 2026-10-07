# Design tokens

Extracted from the screens. Values are exact. Names are suggestions.

## Colors

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0a0c10` | `#f5f6f8` | App background, inset boxes |
| `--panel` | `#11141a` | `#ffffff` | Top bar, rail, cards, side panels, status bar |
| `--panel2` | `#181c24` | `#eceef2` | Selected rows, pills, hover-level surfaces |
| `--line` | `#252b36` | `#dcdfe6` | Borders and dividers |
| `--text` | `#e9ecf1` | `#12151b` | Primary text |
| `--muted` | `#9ba4b3` | `#4d5666` | Secondary text, inactive icons |
| `--faint` | `#8791a1` | `#5b6575` | Captions, section labels, file metadata |
| `--accent` | `#2f6fed` | `#2257d6` | Primary buttons, user bubbles, selected tab, focus fills |
| `--accentFg` | `#8ab4ff` | `#1d4fc4` | Accent used as text or icon color, active rail icon, focus ring |
| `--onAccent` | `#ffffff` | `#ffffff` | Text on accent fills |
| `--dot` | `#4ade80` | `#15803d` | "Model loaded" dot |
| `--warn` | `#f0a35c` | `#a85200` | Destructive action (Settings only) |

Rules:
- White text on `--accent` meets 4.5:1 in both themes. Do not lighten the fill.
- Use `--accentFg`, not `--accent`, for accent-colored text on dark surfaces.
- Do not use red and green as the only difference between two states.

## Typography

- Body: Hanken Grotesk, weights 400, 500, 600. Fallback `system-ui, sans-serif`.
- Mono: JetBrains Mono, weights 400, 500. Used for file names, paths, sizes, quantization, counters and values. Fallback `monospace`.

| Role | Size | Weight |
|---|---|---|
| Page title | 28 px | 600, letter-spacing -0.02em |
| First-run title | 32 px | 600, letter-spacing -0.02em |
| Card / row title | 16 px | 600 |
| Section title | 15 px | 600 |
| Body | 14 px | 400 or 500 |
| Secondary | 13 px | 400 |
| Caption and metadata | 12 px | 400 |
| Section label | 11 px | 600, uppercase, letter-spacing 0.08em |

Line heights: 1.5 for body text, 1.55 to 1.65 for chat and passage text.

## Spacing and sizes

- Spacing steps used: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 28, 32, 36, 40 px.
- Primary controls (buttons, icon buttons, rail icons, send): height 44 px.
- Tabs inside the segmented control: height 40 px. Search and inputs: 40 to 44 px.
- Top bar: 60 px minimum. Status bar: 32 px minimum. Rail: 64 px wide.
- Chat column: max-width 760 to 780 px, centered, 28 to 32 px side padding.

## Radii

| Radius | Use |
|---|---|
| 6 px | Small badges, source number chips |
| 9 to 10 px | Buttons, inputs, list rows, logo mark |
| 12 px | Segmented control, inset boxes, icon tiles |
| 14 px | Cards |
| 16 px | Composer, chat bubbles (with one 4 px corner) |
| 999 px | Pills, progress bars, switches |

Chat bubbles: user `16 16 4 16`, assistant `4 16 16 16`.

## Borders and elevation

No shadows. Separation comes from 1 px borders in `--line` and the surface steps `--bg`, `--panel`, `--panel2`. A selected or active card uses a 1 px `--accent` border. An unavailable item uses a dashed `--line` border and `--faint` text.

## Focus

Visible focus ring on every control: 2 px solid `--accentFg`, 2 px offset.

## Icons

Inline SVG, 24 px grid, stroke `currentColor`, stroke width 1.75, round caps and joins. Sizes: 20 px in the rail, 18 px in buttons, 14 to 16 px inline. No emoji.

## CSS variables

```css
:root {
  --bg: #0a0c10; --panel: #11141a; --panel2: #181c24; --line: #252b36;
  --text: #e9ecf1; --muted: #9ba4b3; --faint: #8791a1;
  --accent: #2f6fed; --accentFg: #8ab4ff; --onAccent: #ffffff;
  --dot: #4ade80; --warn: #f0a35c;
}
[data-theme="light"] {
  --bg: #f5f6f8; --panel: #ffffff; --panel2: #eceef2; --line: #dcdfe6;
  --text: #12151b; --muted: #4d5666; --faint: #5b6575;
  --accent: #2257d6; --accentFg: #1d4fc4; --onAccent: #ffffff;
  --dot: #15803d; --warn: #a85200;
}
```

Map these to Tailwind colors (for example `bg-bg`, `bg-panel`, `text-muted`, `border-line`) in `tailwind.config.js` so components never use raw hex values.
