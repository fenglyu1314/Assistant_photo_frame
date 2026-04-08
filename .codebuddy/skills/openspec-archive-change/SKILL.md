---
name: openspec-archive-change
description: Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.1"
  generatedBy: "1.2.0"
---

Archive a completed change in the experimental workflow.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `artifacts`: List of artifacts with their status (`done` or other)

   **If any artifacts are not `done`:**
   - Display warning listing incomplete artifacts
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically `tasks.md`) to check for incomplete tasks.

   Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

   **If no tasks file exists:** Proceed without task-related warning.

4. **Assess delta spec sync state**

   Check for delta specs at `openspec/changes/<name>/specs/`. If none exist, proceed without sync prompt.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `openspec/specs/<capability>/spec.md`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary before prompting

   **Prompt options:**
   - If changes needed: "Sync now (recommended)", "Archive without syncing"
   - If already synced: "Archive now", "Sync anyway", "Cancel"

   If user chooses sync, use Task tool (subagent_type: "general-purpose", prompt: "Use Skill tool to invoke openspec-sync-specs for change '<name>'. Delta spec analysis: <include the analyzed delta spec summary>"). Proceed to archive regardless of choice.

5. **Git merge to main (Squash Merge)**

   This step handles the git workflow: squash merge the feature branch into main, update the roadmap, and delete the branch.

   **5a. Check current branch**
   ```bash
   git branch --show-current
   ```

   - **If already on `main`**: Skip merge step (branch may have already been merged). Announce: "Already on main, skipping merge."
   - **If on a feature branch** (e.g., `feat/<name>` or `fix/<name>`): Proceed with merge.

   **5b. Confirm working tree is clean**
   ```bash
   git status --porcelain
   ```

   **If uncommitted changes exist:**
   - Display warning with file list
   - Use **AskUserQuestion tool** to ask user: "Uncommitted changes found. Commit them before merge?" with options: "Commit and continue", "Stash and continue", "Cancel"
   - If user cancels, stop the entire archive process.

   **5c. Perform Squash Merge**

   ```bash
   git checkout main
   git merge --squash <current-branch>
   ```

   **If merge conflicts occur:**
   - Announce conflict and stop: "Merge conflict detected. Please resolve conflicts manually, then re-run archive."
   - Do NOT attempt automatic conflict resolution.
   - Switch back to the feature branch: `git checkout <feature-branch>`

   **5d. Generate Squash Commit message**

   Generate a descriptive commit message based on the change's design/spec/tasks artifacts. Format:
   ```
   <type>: <short description>

   - <key change 1>
   - <key change 2>
   - <key change N>
   ```

   The `<type>` is inferred from the branch prefix:
   - `feat/` → `feat`
   - `fix/` → `fix`
   - `refactor/` → `refactor`

   Show the proposed commit message to the user and confirm before committing.

   **5e. Commit**
   ```bash
   git commit -m "<generated message>"
   ```

   **5f. Update roadmap status**

   Read `openspec/specs/roadmap/spec.md` and find the Phase corresponding to this change.

   Update the status line from `⏳ 待开始` or `⏳ 进行中` to `✅ 已完成`.

   Also update task checkboxes from `- [ ]` to `- [x]` if not already done.

   Add a change record entry to the 变更记录 table:
   ```
   | <YYYY-MM-DD> | <Phase N> <name> 完成：<brief summary> |
   ```

   Commit the roadmap update:
   ```bash
   git add openspec/specs/roadmap/spec.md
   git commit -m "docs: 更新路线图 — <Phase N> <name> 完成"
   ```

   **5g. Delete feature branch**

   ```bash
   git branch -d <feature-branch>
   ```

   Announce: "🗑️ Deleted branch: <feature-branch>"

6. **Perform the archive**

   Create the archive directory if it doesn't exist:
   ```bash
   mkdir -p openspec/changes/archive
   ```

   Generate target name using current date: `YYYY-MM-DD-<change-name>`

   **Check if target already exists:**
   - If yes: Fail with error, suggest renaming existing archive or using different date
   - If no: Move the change directory to archive

   ```bash
   mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
   ```

7. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - Whether specs were synced (if applicable)
   - Git merge result (branch merged, roadmap updated, branch deleted — or skipped if already on main)
   - Note about any warnings (incomplete artifacts/tasks)

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync skipped")
**Git:** ✓ Squash merged feat/<name> → main, roadmap updated, branch deleted (or "Skipped — already on main")

All artifacts complete. All tasks complete.
```

**Guardrails**
- Always prompt for change selection if not provided
- Use artifact graph (openspec status --json) for completion checking
- Don't block archive on warnings - just inform and confirm
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Show clear summary of what happened
- If sync is requested, use openspec-sync-specs approach (agent-driven)
- If delta specs exist, always run the sync assessment and show the combined summary before prompting
- **Git merge happens BEFORE archive** — if merge fails (conflicts), stop and do NOT archive
- Always confirm the squash commit message with the user before committing
- Never force push or perform destructive git operations
- If already on main (e.g., branch was previously merged), skip git merge steps gracefully
