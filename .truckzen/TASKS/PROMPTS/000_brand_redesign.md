# Prompt 000 -- Redesign App to Match Brand Book

## Priority: CRITICAL (do this BEFORE all other prompts)
## Estimated time: 45-90 minutes
## Depends on: Nothing. This is the first task.

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.
2. Read .truckzen/TASKS/BRAND_GUIDE.md COMPLETELY. This is the official TruckZen design system. Every color, font, spacing value, component style, and animation rule is defined there.
3. Read .truckzen/DONE/CURRENT_STATUS.md.

## Context

TruckZen has an existing UI that was built quickly. The brand book is now finalized and EVERY page in the app must conform to it. This is a full visual redesign of the existing app -- not a rebuild of functionality. All features stay the same. Only the look and feel changes.

## Step 1: Set Up the Design Foundation

### Global CSS Variables
Create or update src/app/globals.css with the FULL set of CSS variables from BRAND_GUIDE.md. These must be the single source of truth for all colors, spacing, radius, and transitions across the app:

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
  /* Light mode */
  --light-bg: #F4F4F6;
  --light-surface: #FFFFFF;
  --light-border: #E2E2E6;
  --light-text: #1A1A22;
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --space-3xl: 48px;
  --space-4xl: 64px;
  /* Motion */
  --transition-micro: 150ms ease-out;
  --transition-std: 250ms ease-in-out;
  --transition-emphasis: 400ms cubic-bezier(.4,0,.2,1);
  --transition-exit: 200ms ease-in;
}
```

Set body defaults:
```css
body {
  background-color: var(--bg);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
```

### Tailwind Config
Update tailwind.config.js (or tailwind.config.ts) to extend the theme with the brand colors so Tailwind classes like bg-surface, text-teal, border-brand-border all work:

```javascript
theme: {
  extend: {
    colors: {
      bg: '#08080C',
      surface: '#111117',
      'surface-2': '#1C1C24',
      'brand-border': '#28283A',
      teal: { DEFAULT: '#00E0B0', hover: '#00B892', active: '#00805F' },
      purple: { DEFAULT: '#7C6CF0', light: '#9D91F5', dark: '#5B4CC4' },
      'text-primary': '#EDEDF0',
      'text-secondary': '#9898A5',
      'text-tertiary': '#5A5A68',
      success: '#00D48E',
      warning: '#FFBE2E',
      error: '#FF6B6B',
    },
    borderRadius: {
      sm: '4px', md: '8px', lg: '12px', xl: '16px',
    },
    fontFamily: {
      sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'SF Mono', 'Courier', 'monospace'],
    },
  }
}
```

### Install Inter Font
Check if Inter is already imported. If not:
```bash
npm install @fontsource/inter
```
Then import in layout.tsx or globals.css:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

## Step 2: Redesign the Layout Shell

### Sidebar Navigation
The sidebar is the main navigation. Redesign it to match:
- BG: var(--surface)
- Width: 240px desktop, collapsible on mobile
- Logo at top: TZ icon + "truckzen" wordmark (truck in text-primary, zen in teal, dot in teal)
- Nav items: 14px, text-secondary default, text-primary on hover, teal left border + teal text when active
- Icon + label pattern using Lucide icons (outline only, 20px, stroke 1.5)
- Dividers between nav groups: 1px var(--border)
- Bottom: user avatar + name + role badge

### Top Bar (if exists)
- BG: var(--bg) or var(--surface)
- Border bottom: 1px var(--border)
- Page title left-aligned, H1 style (24px bold)
- Action buttons right-aligned (primary teal buttons)

### Main Content Area
- BG: var(--bg)
- Padding: 24px desktop, 16px mobile
- Max content width: 1280px centered

## Step 3: Redesign All Existing Pages

Go through EVERY page in src/app/ and update the styling:

### General Rules for ALL Pages
- Page background: var(--bg)
- Cards: bg-surface, border 0.4px border-brand-border, rounded-lg (12px), p-4 to p-6
- Tables: header row bg-surface-2, body rows bg-surface, border-brand-border, text-sm (14px)
- Buttons: primary = bg-teal text-bg rounded-md (8px) font-bold, hover = bg-teal-hover, active = bg-teal-active
- Form inputs: bg-surface-2, border border-brand-border, rounded-md (6px), h-10, placeholder text-tertiary, focus border-teal
- Status badges: h-[22px] rounded-sm (4px), bg at 15% opacity of status color, text in full status color
- Headings: text-primary font-bold
- Body text: text-primary for important content, text-secondary for descriptions, text-tertiary for meta/captions
- Links: text-teal, hover underline
- Dividers: border-brand-border
- Empty states: centered, 32px Lucide icon in text-tertiary, message in text-secondary

### Specific Pages to Check
Look at every page that exists in src/app/ and apply the brand. Common pages likely include:
- Dashboard / home
- Customers list and detail
- Service requests list
- Service orders list and detail
- Smart Drop
- Settings pages
- Fleet / DVIR (if they exist)
- Login / auth pages
- Any other pages

### Login / Auth Pages
- Centered card on var(--bg) background
- Card: bg-surface, max-w-md, rounded-xl (16px), p-8
- Logo centered above the form
- Inputs: full brand styling
- Primary button: full width, teal
- "Forgot password" link: text-teal, text-sm

### Loading States
- Skeleton screens: bg-surface-2 with pulse animation, teal at 20% opacity
- Button loading: spinner icon, disabled state

### Transitions
- All interactive elements: transition-all var(--transition-micro)
- Cards on hover: transform scale(1.01), slight shadow
- Modal/dropdown appear: fade in + slide up 8px, var(--transition-std)
- Respect prefers-reduced-motion

## Step 4: AI Feature Styling

Any existing AI-related features must use purple accent:
- AI badges: bg-purple/15 text-purple-light
- AI icons: text-purple
- AI feature cards: left border 4px purple instead of teal

## Step 5: Verify Icon Usage

Check all icons in the app:
- Must be from Lucide (lucide-react package)
- If any other icon library is used, replace with Lucide equivalents
- Stroke width: 1.5 (Lucide default)
- Outline only. Remove any filled/solid icons.
- Install lucide-react if not present:
  ```bash
  npm install lucide-react
  ```

## Step 6: Responsive Check

- Sidebar collapses to hamburger menu on mobile
- Cards stack vertically on mobile
- Tables become scrollable horizontally on mobile
- Font sizes stay the same (do not shrink on mobile)
- Touch targets: minimum 44px height on mobile buttons

## Verification

- npm run build passes clean
- Every page loads without errors
- Dark mode is applied everywhere (no white/light page backgrounds)
- Colors match the brand book exactly (spot-check with browser dev tools)
- Inter font is loading
- Lucide icons are used throughout
- Teal is used for CTAs and brand accents
- Purple is ONLY used for AI features
- Status badges use correct status colors at 15% opacity
- No emojis anywhere in the UI
- Transitions are smooth (hover, focus, open/close)

## After Task
Update .truckzen/DONE/ files per CC_RULES.md. Git commit and push to dev.
