# .truckzen/ -- Task Management System

## Branch Strategy

- **main** = live site (truckzen.pro). Do not push here during development.
- **dev** = active development. All work happens here.
- Merge to main only when features are tested and ready.

## Two Folders

### TASKS/ -- CC reads from here (never writes)
```
TASKS/
  CC_RULES.md            Coding standards, workflow rules, verification steps
  MASTER_PLAN.md         Full product build plan (all phases, all steps)
  BRAND_GUIDE.md         Official design system (colors, fonts, spacing, components)
  BRAND_BOOK.pdf         Original brand book PDF for reference
  PHASE1_SCHEMA.sql      Complete database schema for Phase 1
  PROMPTS/
    000_brand_redesign.md    Redesign app to match brand book (DO FIRST)
    001_fix_build.md         Fix all build errors
    002_mega_sql.md          Run Phase 1 database migration
    003_service_writer_checkin.md
    004_repair_orders_3c.md
    005_ai_service_writer.md
    006_unit_profiles.md
    007_time_clock.md
    008_estimates_authorization.md
    009_invoicing_payment.md
```

### DONE/ -- CC writes results here (Ken sends these to Claude chat for verification)
```
DONE/
  CURRENT_STATUS.md      What is built, broken, and next (CC updates after every task)
  CHANGELOG.md           Every change, dated, with file lists (CC appends after every task)
  BUILD_LOG.txt          Full npm run build output (CC overwrites after every task)
  GIT_LOG.txt            Full git push output (CC overwrites after every task)
```

## The Flow

1. Ken pastes the master prompt from CC_START.md into Claude Code
2. Ken says "run prompt 000" (or any number)
3. CC reads from TASKS/, does the work, writes results to DONE/
4. Ken sends DONE/CURRENT_STATUS.md and DONE/CHANGELOG.md to Claude (chat)
5. Claude (chat) verifies and says what to run next
6. Ken tells CC "next" or a specific prompt number
7. Repeat
