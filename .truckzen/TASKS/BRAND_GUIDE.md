# TruckZen Brand Guidelines -- Design Reference

Extracted from TruckZen_Brand_Book_Ultimate.pdf. CC: follow these rules for ALL UI work.

---

## Core Identity

- Tagline: "Where Every Process Finds Its Calm"
- Dark-mode-first brand. Dark mode is the default and primary expression.
- Light mode only for print, some emails, and partner contexts.
- Tone: calm, direct, confident. No emojis. No exclamation marks. No hype.

---

## Colors

### Backgrounds (dark mode -- default)
- Background (page base): #08080C
- Surface (cards, panels): #111117
- Surface 2 (elevated, hover): #1C1C24
- Border (lines, dividers): #28283A

### Brand Accent: Teal
- Teal (primary CTA): #00E0B0
- Teal Hover: #00B892
- Teal Active (pressed): #00805F
- Use teal for ALL brand elements, CTAs, and interactive states.

### AI Accent: Purple
- Purple Light (AI badges): #9D91F5
- Purple (AI features): #7C6CF0
- Purple Dark (AI active): #5B4CC4
- Purple is EXCLUSIVELY for AI-powered features and badges. Never use for non-AI elements.

### Text
- Primary (headings, body): #EDEDF0
- Secondary (descriptions): #9898A5
- Tertiary (captions, meta): #5A5A68

### Status Colors
- Success (active, complete): #00D48E
- Warning (pending, caution): #FFBE2E
- Error (failed, overdue): #FF6B6B

### Light Mode (when needed)
- Light BG: #F4F4F6
- White (cards): #FFFFFF
- Light Border: #E2E2E6
- Dark Text: #1A1A22

---

## Typography

### Primary Typeface
Inter (first choice for web), then SF Pro, Helvetica, system sans-serif fallbacks.

### Monospace
JetBrains Mono, SF Mono, Courier

### Type Scale
- Display: 32px / Bold / letter-spacing -0.5px (hero headings)
- H1: 24px / Bold / letter-spacing -0.3px (page titles)
- H2: 20px / Bold / letter-spacing 0 (section headings)
- H3: 16px / Semibold / letter-spacing 0 (card titles)
- Body L: 16px / Regular / letter-spacing 0.2px (feature descriptions)
- Body: 14px / Regular / letter-spacing 0.2px (default body text)
- Small: 12px / Regular / letter-spacing 0.2px (captions, metadata)
- Overline: 10px / Bold / letter-spacing 2px (labels, badges)

### Typography Rules
- Line height: 1.5 for body, 1.2 for headings
- Max line width: 72 characters

---

## Spacing

Base unit: 4px. Consistent spacing creates the zen feeling.

- xs: 4px (inline gaps, icon padding)
- sm: 8px (related items, tight groups)
- md: 12px (card internal padding vertical)
- lg: 16px (card padding horizontal, list gaps)
- xl: 24px (section gaps, card margins)
- 2xl: 32px (major section dividers)
- 3xl: 48px (page section separators)
- 4xl: 64px (hero section padding)

---

## Border Radius

- 4px: badges, tags, inputs
- 8px: buttons, small cards
- 12px: cards, modals (default)
- 16px: large cards, hero sections
- Full (50%): avatars, pills, toggles

---

## Layout Grid

12-column grid. Gutter: 24px. Margins: 24px (mobile), 48px (desktop).

---

## UI Components

### Buttons
- Sizes: 32px (sm) / 40px (md) / 48px (lg)
- Radius: 8px
- Font: Bold
- Types: Primary (teal bg), Secondary (surface 2 bg, teal text), Ghost (transparent, teal text), Danger (error bg)

### Status Badges
- Height: 22px
- Radius: 4px
- Tinted background at ~15% opacity of status color
- Types: Active (success), In Progress (teal), Pending (warning), Overdue (error), Closed (secondary text), AI Powered (purple)

### Cards
- BG: Surface (#111117)
- Border: 0.4px (#28283A)
- Radius: 10-12px
- Padding: 16-24px
- Left accent: 4px Teal bar (optional, for emphasis)

### Form Inputs
- Height: 36-40px
- Radius: 6px
- BG: Surface 2 (#1C1C24)
- Placeholder text: Tertiary color
- Focused state: 1px teal border

---

## Icons

Library: Lucide Icons (lucide.dev)
- Stroke width: 1.5px (Lucide default)
- OUTLINE style ONLY. Never use filled or solid icons.
- Sizes: 16px (inline), 20px (buttons/forms), 24px (nav/sidebar), 32px (empty states)
- Default color: inherit from text
- Active/selected: Teal (#00E0B0)
- AI-related: Purple (#7C6CF0)
- Destructive: Error red (#FF6B6B)
- Never use multi-color icons

---

## Motion and Animation

- Micro (hover, focus): 150ms ease-out
- Standard (open, reveal): 250ms ease-in-out
- Emphasis (page, hero): 400ms cubic-bezier(.4,0,.2,1)
- Exit (close, dismiss): 200ms ease-in
- Entrances: Fade in + slide up (8-12px). Never slide from sides.
- Exits: Fade out only. No slide. Quick and clean.
- Loading: Subtle pulse on skeleton screens. Teal at 20% opacity.
- Hover states: scale(1.02) + slight shadow lift. 150ms ease-out.
- Respect prefers-reduced-motion: disable all animations when set.

---

## CSS Variables (copy-paste into globals.css or tailwind config)

```css
:root {
  /* Backgrounds */
  --bg: #08080C;
  --surface: #111117;
  --surface-2: #1C1C24;
  --border: #28283A;
  /* Brand */
  --teal: #00E0B0;
  --teal-hover: #00B892;
  --teal-active: #00805F;
  /* AI */
  --purple: #7C6CF0;
  --purple-light: #9D91F5;
  --purple-dark: #5B4CC4;
  /* Text */
  --text-primary: #EDEDF0;
  --text-secondary: #9898A5;
  --text-tertiary: #5A5A68;
  /* Status */
  --success: #00D48E;
  --warning: #FFBE2E;
  --error: #FF6B6B;
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  /* Motion */
  --transition-micro: 150ms ease-out;
  --transition-std: 250ms ease-in-out;
  --transition-emphasis: 400ms cubic-bezier(.4,0,.2,1);
}
```

---

## Tone of Voice

- Clear, not clever. Say what you mean in the fewest words.
- Confident, not arrogant. Let the work speak.
- Warm, not casual. Professional warmth, not forced friendliness.
- Direct, not blunt. Respect the reader's time.
- Do: "Your service order has been assigned to Bay 3."
- Don't: "Awesome! Your SO is now with a tech! Stay tuned!"
- No emojis in the UI. No exclamation marks. No buzzwords.

---

## Invoice / Document Design

- Logo top-left
- Invoice number in monospace font
- Status badge for paid/unpaid
- Table headers: Surface 2 background
- Totals: Bold with teal accent line
