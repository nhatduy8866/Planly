# Git Workflow Guideline for Coding Agents

## 1. Purpose

This document defines the required Git workflow for Coding Agents working on this repository.

The Agent must follow this workflow when creating, modifying, committing, pushing, or merging code.

The primary goals are:

- Keep `main` stable.
- Prevent accidental loss of work.
- Keep commits small and meaningful.
- Keep branches focused on one task.
- Make changes easy to review and revert.
- Avoid interfering with other developers' work.

---

# 2. Golden Rules

The Agent MUST follow these rules:

1. Never work directly on `main`.
2. Never commit directly to `main`.
3. Never force-push unless explicitly instructed.
4. Never delete another developer's branch.
5. Never reset or discard uncommitted work without explicit permission.
6. Always inspect the current Git state before making changes.
7. Always synchronize with the latest `main` before starting a new task.
8. Use one dedicated branch per task.
9. Keep commits focused and meaningful.
10. Review the Git diff before committing.
11. Test changes before creating a Pull Request.
12. Never merge a Pull Request unless explicitly authorized.
13. Never commit secrets, credentials, or environment files.
14. Never use Git commands that may destroy work unless explicitly authorized.

---

# 3. Required Workflow

The standard workflow is:

```text
Understand Task
      ↓
Inspect Git State
      ↓
Update main
      ↓
Create Task Branch
      ↓
Implement Changes
      ↓
Review Diff
      ↓
Run Tests
      ↓
Commit
      ↓
Push Branch
      ↓
Create Pull Request
      ↓
Review / CI
      ↓
Update Branch if Necessary
      ↓
Merge (only when authorized)
      ↓
Delete Branch
```

The Agent must not skip steps without a valid reason.

---

# 4. Step 1 — Understand the Task

Before touching Git, determine:

- What feature or bug is being addressed?
- What files are likely to be affected?
- Is this a new feature, bug fix, refactor, test, or documentation task?
- Does an existing Issue or task reference exist?
- Is another Agent or developer already working on the same area?

Do not create a branch or commit until the scope of the task is understood.

If the task is ambiguous, inspect the repository first.

Do not invent requirements.

---

# 5. Step 2 — Inspect Git State

Before making any changes, run:

```bash
git status
git branch --show-current
git log --oneline -5
```

The Agent must know:

- Current branch
- Working tree status
- Recent commits

If there are uncommitted changes that were not created by the Agent:

> Do not modify, reset, stash, or discard them automatically.

Treat them as potentially belonging to another task or developer.

If those changes interfere with the requested task, report the situation before proceeding.

---

# 6. Step 3 — Synchronize `main`

A new task should start from the latest `main`.

Use:

```bash
git switch main
git pull --ff-only origin main
```

The Agent should prefer `--ff-only` because it prevents an accidental merge commit while updating `main`.

If the command fails, do not force the update.

Investigate the reason first.

---

# 7. Step 4 — Create a Task Branch

Create a dedicated branch from the updated `main`.

Branch naming convention:

```text
feature/<name>
fix/<name>
refactor/<name>
test/<name>
docs/<name>
chore/<name>
```

Examples:

```text
feature/schedule-crud
feature/local-notification
feature/daily-routine

fix/notification-timezone
fix/schedule-overlap

refactor/schedule-service

test/schedule-validation

docs/update-readme
```

Create the branch:

```bash
git switch -c feature/<name>
```

The Agent must not reuse an unrelated existing branch for a new task.

---

# 8. One Task = One Branch

Each branch should represent one logical task.

Good:

```text
feature/schedule-crud
```

Containing:

```text
Schedule model
Schedule repository
Schedule service
Schedule CRUD
```

Bad:

```text
feature/update-everything
```

Containing:

```text
Schedule CRUD
Login redesign
Notification system
Database refactor
Unrelated bug fixes
```

Do not mix unrelated changes.

If another problem is discovered during development, do not automatically include it in the current branch unless it is required to complete the task.

---

# 9. Step 5 — Make Changes

The Agent may now modify the project.

During development:

- Keep changes focused.
- Avoid unnecessary file modifications.
- Do not rewrite unrelated code.
- Do not change project architecture without a reason.
- Do not remove existing functionality without authorization.

Frequently inspect:

```bash
git status
```

This helps detect accidental file changes.

---

# 10. Step 6 — Review the Diff

Before committing, inspect the changes:

```bash
git status
git diff
```

For staged changes:

```bash
git diff --cached
```

The Agent must verify:

- Only intended files changed.
- No debugging code remains.
- No temporary files were added.
- No secrets were added.
- No unrelated formatting changes were introduced.
- The implementation matches the requested task.

If unrelated changes are present, do not commit them automatically.

---

# 11. Step 7 — Test Before Commit

Run the project's appropriate tests.

Examples:

```bash
npm test
```

or:

```bash
flutter test
```

or:

```bash
./gradlew test
```

Use the commands appropriate to the project.

The Agent must not claim that tests passed unless they were actually executed.

If tests fail:

1. Determine whether the failure is related to the current changes.
2. Fix the issue if it is part of the current task.
3. Run the tests again.
4. Report unrelated existing failures rather than hiding them.

Never:

- Delete a failing test just to make CI pass.
- Disable tests without authorization.
- Ignore failures without reporting them.

---

# 12. Step 8 — Commit

Only commit after reviewing the changes and testing them.

Use focused commits.

Recommended format:

```text
<type>: <short description>
```

Types:

```text
feat
fix
refactor
test
docs
chore
style
```

Examples:

```text
feat: add schedule creation
feat: add recurring schedule support
fix: prevent duplicate notifications
test: add schedule validation tests
refactor: simplify schedule service
docs: update setup instructions
```

Avoid meaningless commits:

```text
update
fix
changes
done
test
final
final2
```

---

# 13. Commit Granularity

A commit should represent one logical change.

Good:

```text
feat: add schedule model
feat: add schedule repository
feat: implement schedule service
test: add schedule service tests
```

Bad:

```text
feat: implement everything
```

However, do not create excessively small commits that have no meaningful purpose.

The goal is:

> Small enough to review, large enough to represent a meaningful change.

---

# 14. Never Commit Secrets

Before committing, check for:

```text
.env
.env.*
credentials
API keys
private keys
passwords
access tokens
database credentials
```

Never commit secrets.

If configuration is required, use an example file:

```text
.env.example
```

with placeholder values.

---

# 15. Step 9 — Push the Branch

After committing:

```bash
git push -u origin <branch-name>
```

Example:

```bash
git push -u origin feature/schedule-crud
```

After the first push:

```bash
git push
```

The Agent must not push directly to `main`.

---

# 16. Step 10 — Pull Request

After pushing, create a Pull Request:

```text
feature/schedule-crud
        ↓
      main
```

The Pull Request should contain:

### Summary

What was changed.

### Changes

List the important modifications.

### Testing

List the tests that were actually run.

### Notes

Mention limitations, known issues, or follow-up work.

Example:

```markdown
## Summary

Implemented Schedule CRUD.

## Changes

- Added Schedule model
- Added Schedule repository
- Added Schedule service
- Added create/update/delete operations

## Testing

- Schedule creation
- Schedule update
- Schedule deletion
- Invalid schedule validation

## Notes

No known issues.
```

---

# 17. Never Automatically Merge

Creating a Pull Request and merging a Pull Request are separate actions.

The Agent may:

```text
create branch
→ implement
→ commit
→ push
→ create PR
```

But must NOT merge unless the user or repository workflow explicitly authorizes the Agent to do so.

Default behavior:

> Stop after creating the Pull Request and report its status.

---

# 18. Keeping the Branch Updated

If `main` has changed while the Agent's branch is being developed, update the branch before merging.

First:

```bash
git fetch origin
```

Then inspect:

```bash
git log --oneline HEAD..origin/main
```

If the branch needs to be updated:

```bash
git switch main
git pull --ff-only origin main

git switch <feature-branch>
git merge main
```

Resolve conflicts carefully.

After resolving conflicts:

```bash
git status
```

Then run tests again.

Do not assume that code still works after a conflict resolution.

---

# 19. Conflict Resolution

When a merge conflict occurs:

```text
<<<<<<< HEAD
current branch
=======
main branch
>>>>>>> main
```

The Agent must:

1. Inspect both versions.
2. Understand why both changes exist.
3. Preserve the intended behavior of both sides where possible.
4. Remove conflict markers.
5. Run tests.
6. Review the final diff.

Never resolve conflicts by blindly choosing:

```bash
git checkout --ours
```

or:

```bash
git checkout --theirs
```

unless the correct choice is explicitly known.

---

# 20. Rebase Policy

Rebase may be used when the repository workflow explicitly allows it.

If rebasing a private/unshared feature branch:

```bash
git fetch origin
git rebase origin/main
```

After a rebase, pushing may require:

```bash
git push --force-with-lease
```

Never use:

```bash
git push --force
```

Do not rebase a shared branch without considering its impact on other developers.

---

# 21. Force Push Policy

Force push is dangerous.

The Agent must never use:

```bash
git push --force
```

unless explicitly instructed.

If force pushing is genuinely necessary, use:

```bash
git push --force-with-lease
```

`--force-with-lease` is preferred because it provides protection against overwriting remote work that the Agent has not seen.

---

# 22. Destructive Git Commands

The following commands may destroy work:

```bash
git reset --hard
git clean -fd
git checkout -- .
git restore .
git push --force
git branch -D
```

The Agent must not use them automatically.

Before using any potentially destructive command:

1. Determine what will be lost.
2. Verify that the work is disposable.
3. Obtain explicit authorization if user work may be affected.

Never assume uncommitted changes are disposable.

---

# 23. Stashing

Use `git stash` only when necessary.

Before stashing:

```bash
git status
```

If the changes may belong to another task or developer, do not stash them automatically.

Do not use stash as a way to hide unexpected changes.

---

# 24. Existing Uncommitted Changes

If the repository starts with:

```text
modified: fileA
modified: fileB
```

and those changes were not created by the Agent:

> Leave them untouched.

Do not:

```bash
git reset --hard
```

Do not:

```bash
git restore .
```

Do not overwrite them.

Instead, determine whether the requested task can safely proceed without touching those files.

If not, report the conflict.

---

# 25. After Merge

Once the Pull Request has been merged, synchronize the local repository:

```bash
git switch main
git pull --ff-only origin main
```

Delete the local feature branch:

```bash
git branch -d <branch-name>
```

Remote branch deletion should normally be handled by GitHub's Pull Request settings or explicitly when appropriate.

Do not delete branches belonging to other developers.

---

# 26. Hotfixes

For urgent bugs, use:

```text
fix/<bug-name>
```

or:

```text
hotfix/<bug-name>
```

depending on the repository's established convention.

Even urgent fixes should not bypass review unless the project explicitly defines an emergency procedure.

---

# 27. Multiple Agents / Developers

When multiple Agents or developers work simultaneously:

- Never assume another branch is unused.
- Do not modify another person's branch.
- Do not force-push shared branches.
- Avoid modifying the same files unnecessarily.
- Pull the latest `main` before starting new work.
- Keep branches task-specific.

If two tasks modify the same files, expect possible merge conflicts.

The Agent should minimize unnecessary overlap.

---

# 28. Before Finishing a Task

Run:

```bash
git status
git diff
git log --oneline -5
```

Verify:

```text
[ ] Correct branch
[ ] Correct files changed
[ ] No unrelated changes
[ ] No secrets
[ ] Tests passed
[ ] Commit message is meaningful
[ ] Branch pushed
[ ] Pull Request created if required
```

---

# 29. Required Final Report

When the Git workflow is complete, report:

```text
Task:
<task name>

Branch:
<branch name>

Changes:
- ...
- ...

Tests:
- ...
- ...

Commit:
<commit hash> <commit message>

Pull Request:
<status>

Merge:
Not merged / Merged
```

Do not claim a Pull Request, merge, test, or push occurred unless the Agent actually performed the action.

---

# 30. Default Agent Workflow

Unless the user explicitly requests another workflow, use:

```bash
# 1. Inspect
git status
git branch --show-current
git log --oneline -5

# 2. Update main
git switch main
git pull --ff-only origin main

# 3. Create branch
git switch -c feature/<task-name>

# 4. Work
# ... modify files ...

# 5. Review
git status
git diff

# 6. Test
# ... project-specific test command ...

# 7. Commit
git add <relevant-files>
git commit -m "feat: <description>"

# 8. Push
git push -u origin feature/<task-name>

# 9. Create Pull Request
# Stop here unless merge is explicitly authorized.
```

---

# 31. Core Principle

The Agent should treat Git history as a shared project asset.

Therefore:

> Never sacrifice another developer's work or repository stability for convenience.

When uncertain:

```text
Inspect first.
Change minimally.
Test before committing.
Never destroy work.
Never merge without authorization.
```