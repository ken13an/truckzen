# Prompt 001 -- Fix All Build Errors

## Priority: CRITICAL (nothing else works until this passes)
## Estimated time: 15-30 minutes

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.

2. Run `npm run build` and paste the FULL output.
   - If it passes clean with zero errors: skip to step 5.
   - If there are errors: fix every single one before moving on.

3. Known past problem files (check these even if build passes):
   - src/lib/security/index.ts -- had Upstash/Redis imports that don't exist in the project. Remove any imports from @upstash/ratelimit or @upstash/redis. Replace with simple in-memory rate limiting or remove the rate limiting entirely.
   - src/app/api/stripe/webhook/route.ts -- had an invalid `export const config = { api: { bodyParser: false } }` line. This is a Pages Router pattern. App Router doesn't use it. Remove if present.
   - src/app/dvir/page.tsx -- was broken. Check if it compiles. If it references missing components or has type errors, fix them.
   - src/app/settings/users/new/page.tsx -- was broken. Same as above.
   - src/lib/resend.ts or src/lib/integrations/resend.ts -- had import issues. Make sure Resend client is created lazily: export a function getResend() that creates the client on first call, not at module level.

4. Check src/app/customers/page.tsx specifically. 1,482 customers were imported from FullBay CSV. The page was crashing with a runtime error. Likely causes:
   - .map() on null/undefined data
   - Property access on null customer fields
   - Missing fallback for empty/null fields from imported data
   Add null checks everywhere. Use (data ?? []).map() pattern. Use optional chaining on all customer fields.

5. Check package.json -- if Next.js is at 14.2.0, upgrade to latest 14.x PATCH (NOT 15.x):
   ```
   npm install next@14
   ```
   DO NOT run npm install next@latest -- that installs Next.js 15 which has breaking changes.
   Then run npm run build again.

6. Final verification:
   - Run `npm run build` -- paste FULL output to .truckzen/DONE/BUILD_LOG.txt
   - Must show zero errors
   - Run `git checkout dev 2>/dev/null || git checkout -b dev && git add . && git commit -m "Fix all build errors and upgrade Next.js" && git push origin dev`
   - Paste git output to .truckzen/DONE/GIT_LOG.txt

7. Update .truckzen/DONE/CURRENT_STATUS.md and .truckzen/DONE/CHANGELOG.md per CC_RULES.
