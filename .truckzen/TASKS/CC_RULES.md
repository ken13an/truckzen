# TruckZen -- Claude Code Rules

Read this file BEFORE every task. These rules are non-negotiable.

---

## Project Info

- Project path: ~/dev/truckzen/nextjs/
- Live URL: https://truckzen.pro
- GitHub: ken13an/truckzen (root directory is nextjs/ subfolder)
- Supabase project ID: tqjvyzpspcavdsqhweqo
- Admin email: kenanagasiyev@gmail.com
- Framework: Next.js 14.x (App Router)
- Database: Supabase (Postgres + Auth + Realtime + Storage)
- Hosting: Vercel
- Payments: Stripe
- Email: Resend (sender: no-reply@truckzen.pro)
- Error Monitoring: Sentry (NEXT_PUBLIC_SENTRY_DSN in .env.local — do NOT remove sentry configs or next.config.js wrapper)

---

## Folder System

YOU READ FROM: .truckzen/TASKS/ (prompts, rules, plans -- never modify these files)
YOU WRITE TO: .truckzen/DONE/ (status, changelog, build logs, proof)

Never edit anything in TASKS/. Always write your output to DONE/.

---

## Before Every Task

1. Read this file (CC_RULES.md)
2. Read .truckzen/DONE/CURRENT_STATUS.md to understand what is built and what is broken
3. Read the specific prompt file in .truckzen/TASKS/PROMPTS/ that you were told to execute
4. BEFORE writing any new code: look at how existing pages, API routes, and components are built in this project. Match the existing patterns for imports, Supabase client usage, auth checks, error handling, and component structure. Do NOT invent new patterns if the codebase already has a working one.
5. Follow the prompt exactly -- do not skip steps, do not improvise architecture

---

## Coding Standards

### TypeScript Strict
- All files must be .tsx if they contain JSX, .ts otherwise
- No `any` types unless absolutely unavoidable -- use proper interfaces
- All function parameters must be typed
- All return types should be explicit on exported functions

### Null Safety (CRITICAL -- this prevents 80% of runtime crashes)
- Every .map() call must have a fallback: (data ?? []).map(...)
- Every property access on database results must use optional chaining: customer?.name
- Every field from user input or database must handle null/undefined
- Default values for all optional fields in component props
- Never assume a Supabase query returns data -- always check for null/error
- Every array from Supabase: const items = data ?? []
- Every string display: {customer?.name ?? "Unknown"}

### Component Rules
- Use "use client" directive only when the component needs interactivity
- Server components by default
- No inline styles -- use Tailwind classes with brand tokens (see .truckzen/TASKS/BRAND_GUIDE.md)
- PERMANENT RULE -- NO EMOJIS: No emoji characters anywhere in the codebase. Not in UI text, labels, placeholders, status badges, navigation, comments, logs, API responses, Telegram messages, or any other context. Use Lucide React icons for visual indicators. Use text labels like [WARNING], [EXPIRED], [OVERDUE] for status in API/bot messages. This rule is non-negotiable and applies to every file in src/.
- BACK BUTTON RULE: Every page deeper than sidebar level must have a back arrow + parent page name at top left. No exceptions. Examples: Kiosk -> Dashboard, WO detail -> Work Orders, Customer detail -> Customers, any settings sub-page -> Settings.
- SOFT DELETE RULE: When deleting users, set deleted_at = now() instead of hard delete. Show "Deleted" status in Team Members. 30-day grace period before actual removal.
- All UI text must be professional and clean
- BRAND GUIDE IS LAW: every color, font, spacing, radius, icon, and animation must follow .truckzen/TASKS/BRAND_GUIDE.md. Do not invent colors. Do not use generic Tailwind colors like bg-blue-500 or text-gray-400. Use ONLY brand colors: bg-surface, text-teal, border-brand-border, etc.
- Dark mode is the default. Page background is always var(--bg) / bg-bg
- Teal is for brand elements and CTAs. Purple is EXCLUSIVELY for AI features.
- Icons: Lucide only, outline style, stroke 1.5
- Status badges: 15% opacity background tint of the status color

### File Organization
- Pages: src/app/[route]/page.tsx
- API routes: src/app/api/[route]/route.ts
- Shared components: src/components/
- Database query functions: src/lib/ (one file per domain: src/lib/repair-orders.ts, src/lib/customers.ts)
- Types/interfaces: src/types/
- Supabase client: src/lib/supabase.ts (already exists)

### Naming Conventions
- "Service Writer" -- NEVER "Service Advisor" anywhere
- "Repair Order" or "RO" -- NEVER "Work Order" or "WO" in the UI
- "Technician" or "Mechanic" -- both acceptable
- "Unit" -- refers to a truck or trailer
- Database tables: snake_case (repair_orders, repair_order_lines)
- TypeScript interfaces: PascalCase (RepairOrder, RepairOrderLine)
- Component files: PascalCase (RepairOrderCard.tsx)
- Utility files: kebab-case (repair-orders.ts)

### Supabase Multi-Tenant Rules (CRITICAL)
- ALL queries must include .eq('shop_id', shopId) for tenant isolation
- How to get shop_id in API routes: query the users table with the authenticated user's ID from Supabase auth. Pattern:
  ```
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('shop_id').eq('id', user.id).single()
  const shopId = profile.shop_id
  ```
- How to get shop_id in client components: fetch from the user's profile on load or use a context provider
- Row Level Security (RLS) policies must be created for EVERY new table
- RLS uses get_user_shop_id() helper function (NOT jwt claims): CREATE POLICY "shop_isolation" ON table_name FOR ALL USING (shop_id = get_user_shop_id())
- The get_user_shop_id() function looks up shop_id from the users table via auth.uid()
- IMPORTANT: Before creating new RLS policies, check how EXISTING tables (shops, users, customers, service_requests, service_orders) handle RLS. Match their pattern. If they use a different method than get_user_shop_id(), adapt the new tables to match.
- Service role key is for backend API routes ONLY -- never expose to client
- Use supabase.from('table').select() pattern -- never raw SQL from frontend

### Error Handling
- All API routes must have try/catch with proper error responses
- All Supabase queries: const { data, error } = await ... then check error
- User-facing errors: clear and helpful, never raw error messages
- Console.error with context: console.error('[RepairOrders] Failed to fetch:', error)

---

## After EVERY Task (Non-Negotiable)

### 1. Build Check
Run: npm run build
Must show zero errors and "Compiled successfully"
If build fails, fix it before doing anything else

### 2. Update DONE/CURRENT_STATUS.md
- Move completed items to "Built" section
- Add any new issues to "Known Issues"
- Update the "Last Task Completed" field

### 3. Update DONE/CHANGELOG.md
Append an entry:
```
## YYYY-MM-DD -- [Prompt Number] [Brief Title]
- What was done (one line per change)
- Files created: list them
- Files modified: list them
- Database changes: list them
- Build status: PASS or FAIL
```

### 4. Write Build Proof to DONE/BUILD_LOG.txt
Paste the full npm run build output (overwrite previous content)

### 5. Git Commit and Push
IMPORTANT: Always push to the dev branch, NOT main. The main branch is the live site (truckzen.pro) and must stay clean for demos.
```bash
git checkout dev 2>/dev/null || git checkout -b dev
git add .
git commit -m "Brief description of changes"
git push origin dev
```
Write the git push output to DONE/GIT_LOG.txt
NEVER push directly to main. Ken merges dev into main when features are tested and ready for production.

### 6. ONLY THEN say you are done.
If any step above fails, you are NOT done. Fix it first.

---

## Large Prompt Protocol

When a prompt in `.truckzen/TASKS/PROMPTS/` is too large to complete in one session: read the full prompt first, break it into logical chunks, work through one chunk at a time. After each chunk run `npm run build` (must pass 0 errors), `git add . && git commit -m "PROMPT_NUMBER: chunk description" && git push origin dev`, log what you completed in `.truckzen/DONE/CHANGELOG.md`, update `.truckzen/DONE/CURRENT_STATUS.md` with what is done and what remains. If you hit context limits, STOP and write exactly where you left off in `CURRENT_STATUS.md` so the next session picks up from that point. Next session: read `CURRENT_STATUS.md` first, then continue from where you stopped. Never skip verification between chunks. Never mark a prompt complete until every part is done and pushed.

---

## Deploy Rule (MANDATORY after every push)

Vercel deploys from the `main` branch. After every `git push origin dev`, you MUST also merge dev into main and push main so the changes go live on truckzen.pro. Run this exact sequence after every dev push:

```bash
git checkout main && git merge dev --no-edit && git push origin main && git checkout dev
```

Never skip this step. If you push to dev without merging to main, the changes will NOT appear on truckzen.pro.

---

## Visual Verification Rule

After every page restyle, before committing, verify these visually:

1. Buttons have visible solid backgrounds, not just borders
2. Cards have visible background fills (not transparent)
3. Text colors are correct: #EDEDF0 for primary, #9898A5 for secondary, #00E0B0 for teal accents
4. No element looks unstyled, flat, or invisible

If any Tailwind class you used does not produce a visible style, switch to raw hex bracket notation immediately. Examples:
- `bg-teal` does not work → use `bg-[#00E0B0]`
- `bg-surface` does not work → use `bg-[#111117]`
- `text-text-primary` does not work → use `text-[#EDEDF0]`
- `border-brand-border` does not work → use `border-[#28283A]`

Never commit a page that would look broken to a user. When in doubt, use raw hex values — they always compile correctly in any Tailwind version.
