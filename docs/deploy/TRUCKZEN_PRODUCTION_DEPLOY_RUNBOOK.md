# TruckZen — Production Deploy Runbook

## 1. Purpose

This runbook describes the **only** approved way to deploy TruckZen to production
(`https://truckzen.pro/`). It exists to prevent the live site from being
silently replaced by an unrelated or dirty-tree `vercel --prod` deploy.

The single canonical entrypoint is:

```
I_UNDERSTAND_PRODUCTION=YES bash scripts/deploy_prod_guarded.sh
```

(or, equivalently, `npm run deploy:prod:guarded` after exporting the same env var)

## 2. Why this exists

On 2026-04-22 the `truckzen.pro` alias was hijacked by an unrelated
`vercel --prod` deploy made from a feature branch (`fix/estimates-phase4-write-paths`)
with a dirty working tree. The intended landing/login deploy from the clean
release worktree was overwritten in production roughly 90 minutes after it
went live, and the fix required a manual `vercel alias set` to roll the alias
back to the correct deployment.

Root cause: any `vercel --prod` from any branch / any worktree — clean or
dirty — competes for the same production alias. There was no workflow guard
preventing accidental promotion.

## 2A. Production Lineage Rule — do not deploy backward

**NEVER PROD-DEPLOY A BRANCH/SNAPSHOT THAT IS BEHIND CURRENT LIVE ACCEPTED UI/DESIGN TRUTH.**

A Vercel production deploy is a whole snapshot, not an additive patch. If
your deploy source is missing a commit that is already accepted and live,
that accepted change will silently vanish from `truckzen.pro` the moment you
deploy.

`scripts/deploy_prod_guarded.sh` enforces this via a `REQUIRED_LIVE_COMMITS`
ancestor check against HEAD. If your branch does not contain a required
commit, the script refuses to deploy before build.

When a new UI/design change is intentionally accepted into production, add
its short SHA to `REQUIRED_LIVE_COMMITS` in `scripts/deploy_prod_guarded.sh`
with a one-line comment describing what it protects, then commit that
update alongside (or immediately after) the accepted deploy.

See `docs/deploy/TRUCKZEN_PRODUCTION_LINEAGE_RULE.md` for full rationale and
the lineage-fix procedure.

## 3. Forbidden production behaviors

Do not, under any circumstance:

- Run `vercel --prod` (or `npm run deploy:prod`) directly from a feature
  branch, fix branch, or any non-allowlisted branch.
- Run `vercel --prod` from a dirty working tree (uncommitted changes,
  untracked files that affect the build).
- Use `vercel --prod` as a "preview" — preview deploys are
  `vercel deploy` (no `--prod`), and they get their own non-aliased URL.
- Bypass `scripts/deploy_prod_guarded.sh` "just this once."
- Edit `scripts/deploy_prod_guarded.sh` to weaken its checks. If a real
  release needs a different branch or scope, change the configuration
  variables at the top of the script in a reviewed commit.

## 4. Allowed production workflow

1. Pick the worktree/branch that contains exactly the commits you intend to
   ship. By default that is `main` in the canonical repo at
   `/Users/kagasi/dev/truckzen/nextjs`. A dedicated clean release worktree
   (e.g. `/Users/kagasi/dev/truckzen-frontend-deploy-clean`) is acceptable
   if you have one and the script's `ALLOWED_PROD_BRANCH_REGEX` is set
   accordingly for that release.
2. Confirm `git status --porcelain` is empty.
3. Confirm `git log -1` shows the commit you actually want live.
4. Run the guarded script (see step 5).
5. Verify live (see step 6).

Preview / feature deploys are unrestricted. Use `npx vercel deploy`
(without `--prod`). Those produce a unique preview URL and do **not** touch
`truckzen.pro`.

## 5. Step-by-step command

From the repo root of the worktree you intend to release from:

```bash
git status --porcelain          # must be empty
git log -1 --oneline            # confirm the right commit

I_UNDERSTAND_PRODUCTION=YES bash scripts/deploy_prod_guarded.sh
```

If you are intentionally releasing from a branch other than `main`:

```bash
ALLOWED_PROD_BRANCH_REGEX='^(main|release/.*)$' \
I_UNDERSTAND_PRODUCTION=YES \
bash scripts/deploy_prod_guarded.sh
```

The script will refuse to proceed if any of these are true:
- not in a `truckzen` repo root linked to the expected Vercel project,
- `I_UNDERSTAND_PRODUCTION` is not exactly `YES`,
- the working tree is dirty,
- the current branch does not match `ALLOWED_PROD_BRANCH_REGEX`,
- `npm run build` fails,
- the `truckzen.pro` alias cannot be inspected before or after,
- after the deploy, the alias points to a different deployment than the
  one this script just created,
- `https://truckzen.pro/` or `https://truckzen.pro/login` does not return
  HTTP 200 in a fresh `curl`.

## 6. What to verify after deploy

The script prints alias owner before / after, the deployment URL, and HTTP
status codes for `/` and `/login`. It also prints a manual-verification
checklist. After it succeeds, you must still:

1. Hard-refresh `https://truckzen.pro/` in a real browser (or a private
   window) and confirm the landing page renders the intended design.
2. Hard-refresh `https://truckzen.pro/login` and confirm the login page
   renders the intended design.
3. Sign in and spot-check one critical authenticated route (e.g.
   `/dashboard` or the work-orders list).

The script's HTTP-200 check is a sanity baseline, not visual proof.

## 7. What to do if alias drifts again

Symptom: live `https://truckzen.pro/` shows a different page than what your
last deploy intended, even after a hard refresh.

Diagnose without changing anything:

```bash
# Which deployment currently owns the alias?
npx vercel inspect truckzen.pro --scope team_KQcTGcvlPxpFDRLd2dGz2fdV

# What was the source commit / branch for that deployment?
# (Use the inspectorUrl from the inspect output, or the Vercel API:)
TOKEN=$(node -p "require(require('os').homedir() + \
  '/Library/Application Support/com.vercel.cli/auth.json').token")
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v13/deployments/<dpl_id>?teamId=team_KQcTGcvlPxpFDRLd2dGz2fdV" \
  | python3 -m json.tool | grep -E "gitCommitSha|githubCommitSha|gitCommitRef|githubCommitRef|gitDirty"

# List recent production deployments and find the one you intended:
npx vercel ls --scope team_KQcTGcvlPxpFDRLd2dGz2fdV | head -20
```

Once you have identified the correct deployment URL (the one that was built
from the commit you actually want live), re-point the alias:

```bash
npx vercel alias set <correct-deployment-url> truckzen.pro \
  --scope team_KQcTGcvlPxpFDRLd2dGz2fdV
```

Then re-verify with `curl -I https://truckzen.pro/` and a browser hard
refresh. After rollback, find out which command produced the unintended
production deploy and either delete that worktree's habit of running
`vercel --prod` or update `ALLOWED_PROD_BRANCH_REGEX` in the guarded script
so it would have refused.

## 8. Preview deploys vs production deploys

| Action | Command | Affects truckzen.pro? |
|---|---|---|
| Preview deploy (any branch, dirty OK) | `npx vercel deploy` | No — gets a unique preview URL |
| Production deploy (guarded, only path) | `I_UNDERSTAND_PRODUCTION=YES bash scripts/deploy_prod_guarded.sh` | Yes — replaces the live alias |
| Raw production deploy (do not use) | `vercel --prod` / `npm run deploy:prod` | Yes — no guards, this is what caused the 2026-04-22 incident |
| Manual alias rollback | `npx vercel alias set <url> truckzen.pro --scope <team>` | Yes — emergency only |

Preview deploys are encouraged for share-with-stakeholders and CI
verification. Only the guarded path is acceptable for production.
