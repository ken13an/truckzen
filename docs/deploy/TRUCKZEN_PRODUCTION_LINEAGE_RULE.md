# TruckZen Production Lineage Rule

## The rule

**NEVER PROD-DEPLOY A BRANCH/SNAPSHOT THAT IS BEHIND CURRENT LIVE ACCEPTED UI/DESIGN TRUTH.**

Once a design/UI change has been accepted into production on `truckzen.pro`,
no future production deploy may come from a snapshot that does not already
include that change.

## Why this rule exists

A Vercel production deploy is a **whole snapshot**, not an additive patch.
When you run `vercel --prod`, Vercel takes the current source tree and
promotes it as the new live build. Whatever was previously live is replaced
entirely.

That means a later production deploy from a branch built off an *older* base
commit will **silently roll back** any UI/design changes that were accepted
into production between that base commit and now. The later work may be
unrelated (an estimate fix, a work-order tweak), but because it ships as a
full snapshot, it replaces the landing, login, and every other page with
whatever those pages looked like at its base commit.

This is a **deploy lineage problem**, not a code problem. The rolled-back
pages are still correct in their own branch — they were simply never merged
into the snapshot that became live.

## Concrete example

Sequence (generic):

- **A** = old prod (landing v1, login v1)
- **B** = A + landing redesign accepted into prod (landing v2, login v1)
- **C** = A + unrelated estimate work (landing v1, login v1, estimate fix)

If someone deploys **C** to production:

- Vercel publishes C as the new snapshot.
- `truckzen.pro/` now serves landing v1 again — the redesign in B is gone.
- `truckzen.pro/login` still works, but any login change in B is also gone.
- The estimate fix in C is live, but at the cost of rolling back B.

**C was never a descendant of B.** That is the entire failure mode.

## The invariant

For every production deploy, the source snapshot must satisfy:

> `git merge-base --is-ancestor <each accepted-live-commit> HEAD` returns true.

If any accepted-live-commit is not an ancestor of the deploy source, the
deploy would roll back accepted production truth and must be blocked.

## What to do when lineage is missing

If your working branch does not contain a required accepted-live-commit:

1. **STOP.** Do not run `vercel --prod`.
2. Integrate the missing commit into your branch via one of:
   - `git merge` the branch that contains the accepted live truth, or
   - `git rebase` your work onto that branch, or
   - `git cherry-pick` the specific accepted commits (only if they are
     truly isolated).
3. Re-run the guarded deploy script. The ancestor check must pass.
4. Only then deploy.

## Maintaining the rule

Whenever a new UI/design change is intentionally accepted into production:

1. Record the commit SHA of that change.
2. Add it to `REQUIRED_LIVE_COMMITS` in `scripts/deploy_prod_guarded.sh`.
3. Commit that update alongside (or immediately after) the accepted deploy.

From that point on, every future production deploy must include that SHA
as an ancestor of `HEAD`, or the guarded script will refuse to deploy.

## One-line summary

> Production must move forward from current live truth — never backward.
