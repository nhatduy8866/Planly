# Planly Agent Instructions

Before doing any work in this repository, read
`Git Workflow Guideline for Coding Agents.md` completely and treat it as the
mandatory source of truth for all Git operations.

## Required Git Workflow

- Inspect `git status`, the current branch, and recent commits before making
  changes.
- Never modify files, commit, or push directly on `main`.
- Before starting a new task, update `main` with
  `git pull --ff-only origin main`, then create one dedicated task branch using
  the naming convention in the workflow guideline.
- Preserve existing uncommitted work. Never reset, restore, clean, stash, or
  overwrite work automatically when its ownership is uncertain.
- Keep each branch and commit focused on one logical task.
- Review unstaged and staged diffs, check for secrets and unrelated changes,
  and run the appropriate tests before committing.
- Push the task branch and create a Pull Request according to the repository
  workflow. Do not push directly to `main`.
- Never merge a Pull Request unless the user explicitly authorizes the merge.
- Never force-push or use destructive Git commands without explicit user
  authorization.
- Finish every Git task with the final report required by the workflow
  guideline, accurately stating branch, tests, commit, push, Pull Request, and
  merge status.

If these instructions conflict with an ad hoc shortcut, follow the repository
workflow unless the user explicitly supplies a valid exception that does not
risk other developers' work or repository stability.
