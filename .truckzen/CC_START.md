# CC MASTER PROMPT

Paste this into Claude Code. CC handles everything -- setup, folders, branches, tasks.

---

## FIRST TIME SETUP (paste this once, CC does the rest):

```
There is a zip file at ~/Downloads/truckzen-brain.zip. Do the following:

1. Go to the project directory: cd ~/dev/truckzen/nextjs
2. Unzip it here: unzip ~/Downloads/truckzen-brain.zip (if it's already unzipped or .truckzen/ already exists, skip this step)
3. Create a dev branch if it doesn't exist: git checkout -b dev 2>/dev/null || git checkout dev
4. Push the dev branch: git push origin dev 2>/dev/null || true

Now read .truckzen/README.md to understand the folder system. Then read .truckzen/TASKS/CC_RULES.md and .truckzen/DONE/CURRENT_STATUS.md.

Here is how the system works:

.truckzen/TASKS/ = YOUR INSTRUCTIONS. Read from here. Never modify these files.
  - CC_RULES.md = coding standards you follow on every task
  - MASTER_PLAN.md = full product build plan
  - BRAND_GUIDE.md = official design system (colors, fonts, spacing, components)
  - PHASE1_SCHEMA.sql = database schema
  - PROMPTS/ = numbered task files. Each is a complete task.

.truckzen/DONE/ = YOUR OUTPUT. Write all proof of work here after every task.
  - CURRENT_STATUS.md = update what is built, broken, next
  - CHANGELOG.md = append what you changed
  - BUILD_LOG.txt = overwrite with npm run build output
  - GIT_LOG.txt = overwrite with git push output

After setup, read CURRENT_STATUS.md to see what task is next and start running it. If build is broken, fix it first before anything else. Run prompts in order: 000, 001, 002, 003, etc. After each prompt, update DONE/ files. If build passes, move to the next prompt immediately. If build fails, fix it before moving on. Always push to dev branch, NEVER to main.

Start now.
```

---

## RETURNING SESSIONS (when CC already knows the system):

```
Go to ~/dev/truckzen/nextjs. Read .truckzen/DONE/CURRENT_STATUS.md. Pick up where you left off. Run the next prompt in the queue. Same rules as before: update DONE/ after each task, push to dev, move to next if build passes.
```

---

## RUNNING A SPECIFIC PROMPT:

```
Run prompt 004.
```

---

## RUNNING A BATCH:

```
Run prompts 006, 007, 008, and 009 in order. After each, check build passes. If it passes, move to the next immediately. Update DONE/ after each.
```

---

## AFTER CC FINISHES:

Ken grabs two files from .truckzen/DONE/:
- CURRENT_STATUS.md
- CHANGELOG.md

Sends them to Claude (chat) for verification.

## UPDATING THE LIVE SITE:

Tell CC: "Merge dev to main and push."
